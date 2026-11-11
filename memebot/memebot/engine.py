"""Motor: escaneo de candidatos, entradas y monitorización de posiciones."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import json

from . import db, lab, learner, sources, strategies, strategy
from .executor import make_executor


class Engine:
    def __init__(self) -> None:
        self.executor = make_executor()
        self.running = False
        self.halted_reason = ""
        self._tasks: list[asyncio.Task] = []
        self.last_scan = 0.0
        self.stats = {"scanned": 0, "rejected": 0, "bought": 0}
        self._pending: dict[int, str] = {}   # salidas pendientes de confirmar (id -> motivo)
        self.radar: dict[str, dict] = {}     # últimas evaluaciones (para la vista Radar del panel)
        self.regime = {"breadth": 0.5, "label": "neutral", "size_mult": 1.0, "score_bump": 0.0, "n": 0}
        self._lab: tuple[float, dict] = (0.0, {})

    # ---------- control ----------
    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.halted_reason = ""
        self._tasks = [asyncio.create_task(self._scan_loop()), asyncio.create_task(self._monitor_loop())]
        db.log("info", f"Bot iniciado en modo {self.executor.mode}")

    def stop(self, reason: str = "") -> None:
        self.running = False
        for t in self._tasks:
            t.cancel()
        self._tasks = []
        if reason:
            self.halted_reason = reason
        db.log("info", f"Bot detenido {reason}")

    # ---------- helpers ----------
    @staticmethod
    def _today_start() -> float:
        d = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        return d.timestamp()

    def daily_pnl(self) -> float:
        rows = db.q("SELECT COALESCE(SUM(pnl_sol),0) AS p FROM positions WHERE status='closed' AND closed_at>=?",
                    (self._today_start(),))
        return float(rows[0]["p"])

    @staticmethod
    def strategy_cfg() -> dict:
        cfg = db.kv_get("strategy_cfg", {})
        return {k: {"enabled": bool((cfg.get(k) or {}).get("enabled", True))} for k in strategies.KEYS}

    def enabled(self) -> set[str]:
        return {k for k, v in self.strategy_cfg().items() if v["enabled"]}

    def lab_stats(self) -> dict[str, dict]:
        """Estadística por estrategia (caché de 15 s)."""
        if time.time() - self._lab[0] > 15:
            self._lab = (time.time(), {k: lab.stats(k) for k in strategies.KEYS})
        return self._lab[1]

    def open_positions(self):
        return [dict(r) for r in db.q("SELECT * FROM positions WHERE status='open'")]

    # ---------- escaneo / entradas ----------
    async def _scan_loop(self) -> None:
        while self.running:
            try:
                await self.scan_once()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                db.log("error", f"scan: {e}")
            await asyncio.sleep(db.load_settings().scan_interval_s)

    async def scan_once(self) -> None:
        s = db.load_settings()
        self.last_scan = time.time()
        with db.tx() as c:   # limpieza: ticks de más de 3 días
            c.execute("DELETE FROM ticks WHERE ts < ?", (int(time.time()) - 3 * 86400,))
        if self.daily_pnl() <= -s.max_daily_loss_sol:
            if self.running:
                self.stop("límite de pérdida diaria alcanzado")
            return
        open_pos = self.open_positions()
        if len(open_pos) >= s.max_open_positions:
            return
        held = {p["mint"] for p in open_pos}
        now = time.time()
        found = [m for m in await sources.discover_candidates() if m not in held]
        self.stats["candidates"] = len(found)
        seen = {r["mint"]: (r["ts"], r["verdict"]) for r in db.q("SELECT mint,ts,verdict FROM seen")}
        mints = [m for m in found if m not in seen or now - seen[m][0] > self._cooldown(seen[m][1])]
        if not mints:
            return
        pairs = await sources.get_pairs(mints)
        sem = asyncio.Semaphore(6)
        self.regime = lab.update_regime(list(self.radar.values()))
        enabled, stats = self.enabled(), self.lab_stats()
        weights = {k: lab.weight(stats[k]) for k in strategies.KEYS}
        live = self.executor.mode == "live"

        async def vet(mint: str):
            pair = pairs.get(mint)
            if not pair:
                return mint, None, False, "sin par", 0.0, None, None
            base = strategy.score_market(pair)[0]
            sigs = strategies.evaluate_all(pair, s, enabled)
            if not sigs:
                _, why = strategy.check_entry(pair, s, base)
                return mint, pair, False, why if why != "ok" else "ninguna estrategia lo ve claro", base, None, None
            sig = max(sigs, key=lambda g: g.score * weights[g.strategy])
            async with sem:                              # RugCheck solo si alguna estrategia lo ve (con caché)
                rep = await self._rugcheck(mint)
            ok, why = strategy.check_rugcheck(rep, s)
            if not ok:
                return mint, pair, False, why, sig.score, sig, None
            safety = strategy.score_safety(rep)
            feats = learner.entry_features(pair, safety, sources.pair_age_minutes(pair))
            score = min(100.0, sig.score + safety + learner.adjust(feats))
            need = (s.min_score if sig.strategy == "momentum" else 45.0) + self.regime["score_bump"]
            if score < need:
                return mint, pair, False, f"convicción {score:.0f} < {need:.0f}", score, sig, feats
            if live and not lab.live_allowed(stats[sig.strategy]):
                return mint, pair, False, "estrategia sin ventaja demostrada (dinero real)", score, sig, feats
            return mint, pair, True, "ok", score, sig, feats

        results = await asyncio.gather(*(vet(m) for m in mints))
        results.sort(key=lambda r: r[4], reverse=True)          # primero lo más convincente
        for mint, pair, ok, why, score, sig, feats in results:
            self.stats["scanned"] += 1
            self._mark_seen(mint, "ok" if ok else why)
            self._radar_update(mint, pair, score, "ok" if ok else why, sig.strategy if sig else None)
            if not ok:
                self.stats["rejected"] += 1
                continue
            cur = self.open_positions()
            if len(cur) >= s.max_open_positions or mint in {p["mint"] for p in cur}:
                continue
            used = lambda rows: sum(p["entry_sol"] * p["tokens"] / p["tokens_initial"] for p in rows)
            size = strategy.position_size(score, s) * weights[sig.strategy] * self.regime["size_mult"]
            size = min(size, s.max_exposure_sol - used(cur),
                       s.max_exposure_sol * 0.5 - used([p for p in cur if p["strategy"] == sig.strategy]))
            if size < s.position_size_sol * 0.3:
                continue                                         # sin hueco de exposición (global o de la estrategia)
            await self._open(mint, pair, s, size, score, sig, feats)

    def _radar_update(self, mint: str, pair: dict | None, score: float, verdict: str, strat: str | None = None) -> None:
        if not pair:
            return
        tx = (pair.get("txns") or {}).get("m5") or {}
        self.radar[mint] = {
            "mint": mint, "symbol": (pair.get("baseToken") or {}).get("symbol", "?"),
            "image": (pair.get("info") or {}).get("imageUrl"), "score": round(score, 1), "verdict": verdict,
            "price": pair.get("priceUsd"), "c5": (pair.get("priceChange") or {}).get("m5"),
            "c1": (pair.get("priceChange") or {}).get("h1"),
            "liq": (pair.get("liquidity") or {}).get("usd"), "mcap": pair.get("marketCap") or pair.get("fdv"),
            "buys": tx.get("buys", 0), "sells": tx.get("sells", 0), "ts": time.time(), "strategy": strat,
        }
        if len(self.radar) > 150:
            for k in sorted(self.radar, key=lambda k: self.radar[k]["ts"])[:50]:
                del self.radar[k]

    def radar_list(self, n: int = 40) -> list[dict]:
        cutoff = time.time() - 600
        rows = [r for r in self.radar.values() if r["ts"] > cutoff]
        return sorted(rows, key=lambda r: (r["verdict"] != "ok", -r["score"]))[:n]

    @staticmethod
    def _cooldown(verdict: str) -> float:
        """Segundos antes de volver a evaluar un token según por qué se rechazó."""
        if verdict == "ok":
            return 600
        if verdict.startswith(("mint authority", "freeze authority", "riesgo", "holder", "top10", "score")):
            return 1800     # problema estructural: no cambia
        if verdict.startswith(("liquidez 0", "sin par", "sin informe")):
            return 30       # token recién creado: en unos segundos tendrá pool
        if verdict.startswith("estrategia sin ventaja"):
            return 120
        return 25           # mercado (momentum, ratio, volumen...): cambia rápido

    _rug_cache: dict[str, tuple[float, dict | None]] = {}

    async def _rugcheck(self, mint: str):
        hit = self._rug_cache.get(mint)
        if hit and time.time() - hit[0] < 900:
            return hit[1]
        rep = await sources.rugcheck(mint)
        if rep:
            self._rug_cache[mint] = (time.time(), rep)
        return rep

    @staticmethod
    def _mark_seen(mint: str, verdict: str) -> None:
        with db.tx() as c:
            c.execute("INSERT OR REPLACE INTO seen(mint,ts,verdict) VALUES(?,?,?)", (mint, time.time(), verdict))

    async def _open(self, mint: str, pair: dict, s, size_sol: float | None = None, score: float = 0.0,
                    sig=None, feats=None) -> None:
        price = float(pair["priceUsd"])
        sym = (pair.get("baseToken") or {}).get("symbol", "?")
        fill = await self.executor.buy(mint, price, size_sol or s.position_size_sol, s,
                                       liq=float((pair.get("liquidity") or {}).get("usd") or 0))
        if not fill.ok:
            db.log("warn", f"compra fallida {sym}: {fill.error}")
            return
        now = time.time()
        with db.tx() as c:
            cur = c.execute(
                """INSERT INTO positions(mint,symbol,pair,mode,opened_at,entry_price,entry_sol,tokens,
                   tokens_initial,peak_price,last_price,image,score,strategy,params,features) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (mint, sym, pair.get("pairAddress"), self.executor.mode, now, price, fill.sol,
                 fill.tokens, fill.tokens, price, price, (pair.get("info") or {}).get("imageUrl"), score,
                 sig.strategy if sig else "momentum", json.dumps(sig.exit) if sig else None,
                 json.dumps(feats) if feats else None))
            c.execute("INSERT OR REPLACE INTO ticks(position_id,ts,price) VALUES(?,?,?)",
                      (cur.lastrowid, int(now), price))
            c.execute("INSERT INTO trades(position_id,ts,side,mint,symbol,price,tokens,sol,reason,tx,mode) "
                      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (cur.lastrowid, now, "buy", mint, sym, price, fill.tokens, fill.sol, "entrada",
                       fill.tx, self.executor.mode))
        self.stats["bought"] += 1
        lbl = strategies.META[sig.strategy]["label"] if sig else "Momentum"
        db.log("info", f"COMPRA {sym} a ${price:.8g} ({fill.sol:.3f} SOL · {lbl} · convicción {score:.0f})")

    # ---------- monitorización / salidas ----------
    async def _monitor_loop(self) -> None:
        while self.running:
            try:
                await self.monitor_once()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                db.log("error", f"monitor: {e}")
            await asyncio.sleep(db.load_settings().monitor_interval_s)

    async def monitor_once(self) -> None:
        s = db.load_settings()
        positions = self.open_positions()
        if not positions:
            return
        pairs = await sources.get_pairs([p["mint"] for p in positions],
                                        {p["mint"]: p["pair"] for p in positions})
        now = time.time()
        for pos in positions:
            pair = pairs.get(pos["mint"])
            if not pair:
                continue
            price = float(pair.get("priceUsd") or 0)
            if price <= 0:
                continue
            liq = float((pair.get("liquidity") or {}).get("usd") or 0)
            pos["peak_price"] = max(pos["peak_price"], price)
            with db.tx() as c:
                c.execute("UPDATE positions SET last_price=?, peak_price=? WHERE id=?",
                          (price, pos["peak_price"], pos["id"]))
                c.execute("INSERT OR REPLACE INTO ticks(position_id,ts,price) VALUES(?,?,?)",
                          (pos["id"], int(now), price))
            pos["_liq"] = liq
            decision = strategy.check_exit(pos, price, liq, now, s, pair)
            if not decision:
                self._pending.pop(pos["id"], None)
                await self._maybe_scale_in(pos, pair, price, s)
                continue
            # confirmación: exige 2 lecturas seguidas con el mismo motivo (filtra ticks falsos del feed)
            if decision[0] not in ("tiempo_maximo", "sin_movimiento") and self._pending.get(pos["id"]) != decision[0]:
                self._pending[pos["id"]] = decision[0]
                continue
            self._pending.pop(pos["id"], None)
            await self._sell(pos, price, *decision, s)

    async def _maybe_scale_in(self, pos: dict, pair: dict, price: float, s) -> None:
        """Refuerzo: la posición gana y la convicción sigue alta -> añade una vez."""
        if not s.scale_in_enabled or pos["adds"] >= 1 or pos["tp1_done"] or pos["strategy"] not in ("momentum", "trend"):
            return
        chg = (price / pos["entry_price"] - 1) * 100
        if not (s.scale_in_trigger_pct <= chg < s.take_profit_1_pct - 2):
            return
        score = strategy.score_market(pair)[0] + strategy.score_safety((self._rug_cache.get(pos["mint"]) or (0, None))[1])
        if score < s.scale_in_min_score:
            return
        cur = self.open_positions()
        used = sum(p["entry_sol"] * p["tokens"] / p["tokens_initial"] for p in cur)
        size = s.position_size_sol * s.scale_in_size_mult
        if used + size > s.max_exposure_sol:
            return
        fill = await self.executor.buy(pos["mint"], price, size, s, liq=float((pair.get("liquidity") or {}).get("usd") or 0))
        if not fill.ok:
            return
        old_t, old_p = pos["tokens_initial"], pos["entry_price"]
        avg = (old_t * old_p + fill.tokens * price) / (old_t + fill.tokens)
        now = time.time()
        with db.tx() as c:
            c.execute("UPDATE positions SET entry_price=?, entry_sol=entry_sol+?, tokens=tokens+?, "
                      "tokens_initial=tokens_initial+?, adds=adds+1 WHERE id=?",
                      (avg, fill.sol, fill.tokens, fill.tokens, pos["id"]))
            c.execute("INSERT INTO trades(position_id,ts,side,mint,symbol,price,tokens,sol,reason,tx,mode) "
                      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (pos["id"], now, "buy", pos["mint"], pos["symbol"], price, fill.tokens, fill.sol,
                       "refuerzo", fill.tx, self.executor.mode))
        self.stats["bought"] += 1
        db.log("info", f"REFUERZO {pos['symbol']} +{fill.sol:.3f} SOL (convicción {score:.0f}, {chg:+.1f}%)")

    async def _sell(self, pos: dict, price: float, reason: str, frac: float, s) -> None:
        tokens = pos["tokens"] * frac
        fill = await self.executor.sell(pos["mint"], tokens, price, s, liq=pos.get("_liq", 0.0))
        if not fill.ok:
            db.log("warn", f"venta fallida {pos['symbol']} ({reason}): {fill.error}")
            return
        now = time.time()
        remaining = pos["tokens"] - fill.tokens
        realized = pos["realized_sol"] + fill.sol
        closing = frac >= 0.999 or remaining <= pos["tokens_initial"] * 1e-6
        with db.tx() as c:
            c.execute("INSERT INTO trades(position_id,ts,side,mint,symbol,price,tokens,sol,reason,tx,mode) "
                      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (pos["id"], now, "sell", pos["mint"], pos["symbol"], price, fill.tokens, fill.sol,
                       reason, fill.tx, self.executor.mode))
            if closing:
                c.execute("UPDATE positions SET status='closed', closed_at=?, tokens=0, realized_sol=?, "
                          "exit_reason=?, pnl_sol=?, last_price=? WHERE id=?",
                          (now, realized, reason, realized - pos["entry_sol"], price, pos["id"]))
            else:
                c.execute("UPDATE positions SET tokens=?, realized_sol=?, tp1_done=1 WHERE id=?",
                          (remaining, realized, pos["id"]))
        db.log("info", f"VENTA {pos['symbol']} {reason} ({fill.sol:.4f} SOL)")
        if closing:
            pnl = realized - pos["entry_sol"]
            db.log("info", f"RESULTADO {pos['symbol']} {pnl / pos['entry_sol'] * 100:+.1f}% ({pnl:+.4f} SOL)")
            self._lab = (0.0, {})
            try:
                await asyncio.to_thread(learner.maybe_train)
            except Exception as e:  # noqa: BLE001
                db.log("warn", f"aprendizaje: {e}")
