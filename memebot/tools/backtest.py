"""Backtest honesto de estrategias de memecoins con velas de 1 min (GeckoTerminal).

Uso:  python tools/fetch_history.py hist.json      (descarga datos)
      python tools/backtest.py hist.json            (simula)

Reglas para no engañarse:
  * costes realistas por operación (comisión + deslizamiento + latencia)
  * dentro de una vela, si toca stop y objetivo, se asume que toca el STOP primero
  * estrategia de CONTROL (entrar al azar con las mismas salidas): si una estrategia no la supera, no tiene ventaja
  * los parámetros se eligen con una mitad de los pools (dev) y se evalúan en la otra (holdout)
  * intervalo de confianza bootstrap de la media: «sin ventaja» si el 0 cabe dentro
Límites: velas sin tick buy/sell, sesgo de supervivencia (los pools en tendencia ya se movieron), pocos días.
"""
from __future__ import annotations

import itertools
import json
import random
import statistics
import sys
import zlib
from datetime import datetime

COST = 0.03      # por lado: comisión del pool + deslizamiento + prioridad/MEV medios en memecoins
LAG = 1          # nº de velas de retraso en la ejecución (≈ 5-20 s reales; aquí 1 vela = 1 min, es conservador)


def _ts(p):
    return p["created"]


# ---------- características por vela (calculadas UNA vez por pool) ----------
import bisect


def pool_features(cs):
    ts = [c[0] for c in cs]
    pref = [0.0]
    for c in cs:
        pref.append(pref[-1] + c[5])
    vsum = lambda lo_t, hi_t: pref[bisect.bisect_right(ts, hi_t)] - pref[bisect.bisect_left(ts, lo_t)]
    out = {}
    for i in range(60, len(cs) - 3):
        t = ts[i]
        i5 = bisect.bisect_left(ts, t - 300)
        v5 = vsum(t - 300, t)
        vb = vsum(t - 3900, t - 301) / 11
        j6 = bisect.bisect_left(ts, t - 360)
        p5 = cs[j6][4]
        j20, j30, j180 = (bisect.bisect_left(ts, t - x) for x in (1200, 1800, 10800))
        hi20 = max((c[2] for c in cs[j20: bisect.bisect_left(ts, t - 59)]), default=0)
        hi30 = max((c[2] for c in cs[j30: i + 1]), default=0)
        lo180 = min((c[3] for c in cs[j180: i + 1]), default=cs[i][3])
        out[i] = dict(price=cs[i][4], v5=v5, accel=v5 / max(vb, 1), ret5=cs[i][4] / p5 - 1 if p5 else 0, hi20=hi20,
                      drop30=cs[i][4] / hi30 - 1 if hi30 else 0, run3h=(hi30 / lo180) if lo180 else 1,
                      green2=all(c[4] > c[1] for c in cs[i - 1: i + 1]), minute=(t - ts[0]) / 60)
    return out


STRATS = {
    "breakout": lambda f: f["price"] > f["hi20"] > 0 and f["accel"] >= 3 and 0.03 <= f["ret5"] <= 0.30,
    "dip_buy": lambda f: f["drop30"] <= -0.15 and f["green2"] and f["run3h"] >= 1.5 and f["accel"] >= 1.2,
    "vol_spike": lambda f: f["accel"] >= 5 and abs(f["ret5"]) <= 0.03 and f["v5"] >= 500,
    "early_10m": lambda f: 10 <= f["minute"] < 11 and f["v5"] >= 500,
    "CONTROL_azar": None,   # entra cada 40 min sin mirar nada
}
_SIGS: dict = {}


def signal_indices(p, name):
    """Velas en las que dispara la estrategia (con 30-40 min de enfriamiento entre entradas del mismo pool)."""
    key = (p["addr"], name)
    if key in _SIGS:
        return _SIGS[key]
    cs = p["candles"]
    idx, nxt = [], 0
    if name == "CONTROL_azar":
        idx = list(range(60, len(cs) - 3, 40))
    else:
        feats = p.setdefault("_f", None) or pool_features(cs)
        p["_f"] = feats
        for i in sorted(feats):
            if cs[i][0] >= nxt and STRATS[name](feats[i]):
                idx.append(i)
                nxt = cs[i][0] + 1800
    _SIGS[key] = idx
    return idx


# ---------- simulación de una operación ----------
def simulate(cs, i, sl, tp, hold, trail=0.0):
    j0 = i + 1 + LAG
    if j0 >= len(cs):
        return None
    entry = cs[j0][1] * (1 + COST)
    peak = cs[j0][1]
    t0 = cs[j0][0]
    for j in range(j0, len(cs)):
        o, h, l, c = cs[j][1:5]
        stop = peak * (1 - trail) if (trail and peak > entry * 1.05) else entry * (1 - sl)
        stop = max(stop, entry * (1 - sl))
        if l <= stop:
            px = min(o, stop)
            return px * (1 - COST) / entry - 1
        if h >= entry * (1 + tp):
            px = max(o, entry * (1 + tp))
            return px * (1 - COST) / entry - 1
        peak = max(peak, h)
        if cs[j][0] - t0 >= hold * 60:
            return c * (1 - COST) / entry - 1
    return cs[-1][4] * (1 - COST) / entry - 1


def run(pools, name, sl, tp, hold, trail=0.0):
    out = []
    for p in pools:
        cs = p["candles"]
        if (p.get("liq") and float(p["liq"]) < 5000) or len(cs) < 100:
            continue
        for i in signal_indices(p, name):
            r = simulate(cs, i, sl, tp, hold, trail)
            if r is not None:
                out.append(r)
    return out


def boot_ci(xs, n=1500):
    if len(xs) < 8:
        return (float("nan"), float("nan"))
    rnd = random.Random(7)
    ms = sorted(statistics.fmean(rnd.choices(xs, k=len(xs))) for _ in range(n))
    return ms[int(n * .025)], ms[int(n * .975)]


def summ(xs):
    if not xs:
        return "n=0"
    lo, hi = boot_ci(xs)
    return (f"n={len(xs):4d} media={statistics.fmean(xs) * 100:+6.1f}% mediana={statistics.median(xs) * 100:+6.1f}% "
            f"acierto={sum(x > 0 for x in xs) / len(xs) * 100:4.0f}% IC95=[{lo * 100:+.1f},{hi * 100:+.1f}]")


def main(path):
    pools = json.load(open(path))
    pools = [p for p in pools if p.get("candles")]
    dev = [p for p in pools if zlib.crc32(p["addr"].encode()) % 2 == 0]
    hold_ = [p for p in pools if zlib.crc32(p["addr"].encode()) % 2 == 1]
    print(f"{len(pools)} pools ({len(dev)} dev / {len(hold_)} holdout), coste {COST * 100:.0f}% por lado, retraso {LAG} vela")
    kinds = {}
    for p in pools:
        kinds[p["kind"]] = kinds.get(p["kind"], 0) + 1
    print("origen:", kinds, "\n")
    grid = list(itertools.product([0.10, 0.18, 0.25], [0.10, 0.20, 0.40, 1.0], [15, 45, 120], [0.0, 0.08]))
    for name in STRATS:
        res = []
        for sl, tp, hold, trail in grid:
            x = run(dev, name, sl, tp, hold, trail)
            if len(x) >= 12:
                res.append((statistics.fmean(x), (sl, tp, hold, trail), len(x)))
        if not res:
            print(f"{name:14s} sin señales suficientes"); continue
        res.sort(reverse=True)
        m, params, n = res[0]
        sl, tp, hold, trail = params
        print(f"== {name}: mejores parámetros en DEV -> SL {sl:.0%} TP {tp:.0%} hold {hold}m trail {trail:.0%}")
        print("   DEV     ", summ(run(dev, name, *params)))
        print("   HOLDOUT ", summ(run(hold_, name, *params)))
        # y con salidas «razonables» fijas (no optimizadas)
        fixed = (0.18, 0.20, 45, 0.08)
        print("   fijas SL18/TP20/45m/trail8 · TODOS", summ(run(pools, name, *fixed)))
        print()


if __name__ == "__main__":
    main(sys.argv[1])
