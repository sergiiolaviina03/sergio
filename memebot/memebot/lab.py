"""Laboratorio: estadística por estrategia, régimen de mercado y compuerta de evidencia.

Idea central: en memecoins casi todo pierde de media (los estudios serios no encuentran ventaja en datos públicos),
así que el bot NO asume que una estrategia funciona: la mide. Cada estrategia lleva su contabilidad, un intervalo de
confianza de su rentabilidad media por operación y un veredicto. Con dinero real solo pueden operar las que
demuestren ventaja positiva (límite inferior del IC95 > 0 con >= 30 operaciones).
"""
from __future__ import annotations

import math
import time

from . import db

MIN_TRADES_VERDICT = 30
MIN_TRADES_WEIGHT = 10


def closed(strategy: str | None = None, limit: int = 400):
    sql = "SELECT strategy, entry_sol, pnl_sol, opened_at, closed_at FROM positions WHERE status='closed'"
    args: tuple = ()
    if strategy:
        sql += " AND strategy=?"
        args = (strategy,)
    return db.q(sql + " ORDER BY closed_at DESC LIMIT ?", args + (limit,))


def stats(strategy: str) -> dict:
    rows = closed(strategy)
    r = [x["pnl_sol"] / x["entry_sol"] for x in rows if x["entry_sol"] > 0]    # rentabilidad neta por operación
    n = len(r)
    out = {"n": n, "wins": sum(1 for x in r if x > 0), "mean": None, "ci": None, "verdict": "sin_datos",
           "pnl_sol": sum(x["pnl_sol"] for x in rows), "equity": [], "avg_hold_min": None}
    if rows:
        out["avg_hold_min"] = sum(x["closed_at"] - x["opened_at"] for x in rows) / n / 60
        acc = 0.0
        for x in reversed(rows):
            acc += x["pnl_sol"]
            out["equity"].append(round(acc, 5))
    if n >= 2:
        m = sum(r) / n
        sd = math.sqrt(sum((x - m) ** 2 for x in r) / (n - 1))
        half = 1.96 * sd / math.sqrt(n)
        out["mean"], out["ci"] = m, (m - half, m + half)
        if n < MIN_TRADES_WEIGHT:
            out["verdict"] = "sin_datos"
        elif n < MIN_TRADES_VERDICT:
            out["verdict"] = "en_prueba"
        elif out["ci"][0] > 0:
            out["verdict"] = "ventaja"
        elif out["ci"][1] < 0:
            out["verdict"] = "pierde"
        else:
            out["verdict"] = "sin_ventaja"
    return out


def weight(st: dict) -> float:
    """Reparto de capital: explora al principio y luego premia lo que gana y castiga lo que pierde."""
    if st["n"] < MIN_TRADES_WEIGHT or st["mean"] is None:
        return 1.0
    return max(0.25, min(2.0, 1.0 + st["mean"] / 0.10))


def live_allowed(st: dict) -> bool:
    """Compuerta de evidencia para dinero real."""
    return st["verdict"] == "ventaja"


# ---------- régimen de mercado ----------
_breadth = {"v": 0.5, "n": 0, "t": 0.0}


def update_regime(rows: list[dict]) -> dict:
    """Amplitud: % de tokens líquidos y activos con precio al alza en 5 min (suavizada)."""
    cutoff = time.time() - 300
    pool = [r for r in rows if r["ts"] > cutoff and (r.get("liq") or 0) >= 5000 and (r["buys"] + r["sells"]) >= 10]
    if len(pool) >= 8:
        cur = sum(1 for r in pool if float(r.get("c5") or 0) > 0) / len(pool)
        _breadth["v"] = 0.8 * _breadth["v"] + 0.2 * cur if _breadth["n"] else cur
        _breadth["n"], _breadth["t"] = len(pool), time.time()
    b = _breadth["v"]
    label, mult, bump = ("bajista", 0.5, 8.0) if b < 0.35 else ("alcista", 1.2, 0.0) if b > 0.55 else ("neutral", 1.0, 0.0)
    return {"breadth": round(b, 3), "label": label, "size_mult": mult, "score_bump": bump, "n": _breadth["n"]}
