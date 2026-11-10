"""Motor: escaneo de candidatos, entradas y monitorización de posiciones."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from . import db, sources, strategy
from .executor import make_executor


class Engine:
    def __init__(self) -> None:
        self.executor = make_executor()
        self.running = False
        self.halted_reason = ""
        self._tasks: list[asyncio.Task] = []
        self.last_scan = 0.0
        self.stats = {"scanned": 0, "rejected": 0, "bought": 0}

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
        if self.daily_pnl() <= -s.max_daily_loss_sol:
            if self.running:
                self.stop("límite de pérdida diaria alcanzado")
            return
        open_pos = self.open_positions()
        if len(open_pos) >= s.max_open_positions:
            return
        held = {p["mint"] for p in open_pos}
        mints = [m for m in await sources.discover_candidates()
                 if m not in held and not db.q("SELECT 1 FROM seen WHERE mint=? AND ts>?", (m, time.time() - 1800))]
        if not mints:
            return
        pairs = await sources.get_pairs(mints)
        for mint in mints:
            if len(self.open_positions()) >= s.max_open_positions:
                break
            self.stats["scanned"] += 1
            pair = pairs.get(mint)
            ok, why = (False, "sin par") if not pair else strategy.check_entry(pair, s)
            if ok:
                ok, why = strategy.check_rugcheck(await sources.rugcheck(mint), s)
            self._mark_seen(mint, "ok" if ok else why)
            if not ok:
                self.stats["rejected"] += 1
                continue
            await self._open(mint, pair, s)

    @staticmethod
    def _mark_seen(mint: str, verdict: str) -> None:
        with db.tx() as c:
            c.execute("INSERT OR REPLACE INTO seen(mint,ts,verdict) VALUES(?,?,?)", (mint, time.time(), verdict))

    async def _open(self, mint: str, pair: dict, s) -> None:
        price = float(pair["priceUsd"])
        sym = (pair.get("baseToken") or {}).get("symbol", "?")
        fill = await self.executor.buy(mint, price, s.position_size_sol, s)
        if not fill.ok:
            db.log("warn", f"compra fallida {sym}: {fill.error}")
            return
        now = time.time()
        with db.tx() as c:
            cur = c.execute(
                """INSERT INTO positions(mint,symbol,pair,mode,opened_at,entry_price,entry_sol,tokens,
                   tokens_initial,peak_price,last_price) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (mint, sym, pair.get("pairAddress"), self.executor.mode, now, price, fill.sol,
                 fill.tokens, fill.tokens, price, price))
            c.execute("INSERT INTO trades(position_id,ts,side,mint,symbol,price,tokens,sol,reason,tx,mode) "
                      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (cur.lastrowid, now, "buy", mint, sym, price, fill.tokens, fill.sol, "entrada",
                       fill.tx, self.executor.mode))
        self.stats["bought"] += 1
        db.log("info", f"COMPRA {sym} a ${price:.8g} ({fill.sol} SOL)")

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
        pairs = await sources.get_pairs([p["mint"] for p in positions])
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
            decision = strategy.check_exit(pos, price, liq, now, s)
            if decision:
                await self._sell(pos, price, *decision, s)

    async def _sell(self, pos: dict, price: float, reason: str, frac: float, s) -> None:
        tokens = pos["tokens"] * frac
        fill = await self.executor.sell(pos["mint"], tokens, price, s)
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
