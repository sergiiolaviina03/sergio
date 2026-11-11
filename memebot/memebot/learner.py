"""Aprendizaje a partir de las propias operaciones (regresión logística en Python puro).

Para cada entrada se guardan las señales de mercado; al cerrar la operación se sabe si ganó. Cada 10 cierres se entrena
un modelo con el 70 % más antiguo y se valida con el 30 % más reciente (nunca visto). Solo se USA si en esa validación
distingue ganadoras de perdedoras (AUC >= 0.58); si no, se ignora. Con pocos datos o ruido, se queda apagado.
"""
from __future__ import annotations

import json
import math

from . import db

NAMES = ["presion_5m", "tendencia_1h", "aceleracion_vol", "aceleracion_tx", "momentum_5m", "subida_1h",
         "liquidez_mcap", "edad", "seguridad"]
MIN_TRAIN, MIN_TEST, MIN_AUC = 40, 12, 0.58


def _num(x, d=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def clip(x, lo, hi):
    return max(lo, min(hi, x))


def entry_features(pair: dict, safety: float, age_min: float | None) -> list[float]:
    tx = pair.get("txns") or {}
    m5, h1 = tx.get("m5") or {}, tx.get("h1") or {}
    vol = pair.get("volume") or {}
    pc = pair.get("priceChange") or {}
    b5, s5, b1, s1 = m5.get("buys", 0), m5.get("sells", 0), h1.get("buys", 0), h1.get("sells", 0)
    mc = _num(pair.get("marketCap") or pair.get("fdv"))
    liq = _num((pair.get("liquidity") or {}).get("usd"))
    return [
        clip((b5 / max(s5, 1) - 1) / 2, -1, 2), clip((b1 / max(s1, 1) - 1) / 1, -1, 2),
        clip(math.log10(max((_num(vol.get("m5")) * 12) / max(_num(vol.get("h1")), 1), 0.01)), -1, 1.5),
        clip(math.log10(max(((b5 + s5) * 12) / max(b1 + s1, 1), 0.01)), -1, 1.5),
        clip(_num(pc.get("m5")) / 20, -1.5, 1.5), clip(_num(pc.get("h1")) / 150, -1.5, 2),
        clip((liq / mc) / 0.15 if mc > 0 else 0, 0, 2), clip(math.log10(max(age_min or 1, 1)) / 3, 0, 1.5), safety / 10,
    ]


def _sig(z):
    return 1 / (1 + math.exp(-clip(z, -30, 30)))


def _fit(X, y, epochs=400, lr=0.3, l2=0.05):
    w, b = [0.0] * len(X[0]), 0.0
    n = len(X)
    for _ in range(epochs):
        gw, gb = [0.0] * len(w), 0.0
        for xi, yi in zip(X, y):
            e = _sig(sum(a * c for a, c in zip(w, xi)) + b) - yi
            gb += e
            for k, c in enumerate(xi):
                gw[k] += e * c
        w = [wk - lr * (g / n + l2 * wk) for wk, g in zip(w, gw)]
        b -= lr * gb / n
    return w, b


def _auc(scores, y):
    pos = [s for s, t in zip(scores, y) if t]
    neg = [s for s, t in zip(scores, y) if not t]
    if not pos or not neg:
        return 0.5
    wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return wins / (len(pos) * len(neg))


def status() -> dict:
    return db.kv_get("learner", {"n": 0, "active": False, "auc": None, "base": None, "weights": {}, "trained_at_n": 0})


def maybe_train() -> dict:
    st = status()
    rows = db.q("SELECT features, pnl_sol, entry_sol FROM positions WHERE status='closed' AND features IS NOT NULL "
                "ORDER BY closed_at")
    n = len(rows)
    st["n"] = n
    if n < MIN_TRAIN or n - st.get("trained_at_n", 0) < 10:
        db.kv_set("learner", st)
        return st
    X = [json.loads(r["features"]) for r in rows]
    y = [1 if r["pnl_sol"] > 0 else 0 for r in rows]
    cut = int(n * 0.7)
    w, b = _fit(X[:cut], y[:cut])
    test_scores = [sum(a * c for a, c in zip(w, x)) + b for x in X[cut:]]
    auc = _auc(test_scores, y[cut:])
    w_all, b_all = _fit(X, y)                      # el modelo final usa todos los datos si la validación es buena
    st.update({"auc": round(auc, 3), "base": round(sum(y) / n, 3), "trained_at_n": n,
               "active": bool(auc >= MIN_AUC and (n - cut) >= MIN_TEST), "test_n": n - cut,
               "weights": {k: round(v, 3) for k, v in zip(NAMES, w_all)}, "model": {"w": w_all, "b": b_all}})
    db.kv_set("learner", st)
    return st


def adjust(features: list[float]) -> float:
    """Puntos (±12) que se suman a la convicción si el modelo está activo y validado."""
    st = status()
    if not st.get("active") or "model" not in st:
        return 0.0
    m = st["model"]
    p = _sig(sum(a * c for a, c in zip(m["w"], features)) + m["b"])
    return clip((p - st["base"]) * 40, -12, 12)
