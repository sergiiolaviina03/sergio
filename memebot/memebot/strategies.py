"""Estrategias: cada una busca una situación de mercado distinta y trae sus propias salidas.

Todas devuelven un Signal (o None). La convicción base de una señal que cumple las condiciones es 40; sube con la
fuerza de las señales hasta ~100. El motor las compara y reparte capital según lo que demuestre el laboratorio.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from . import strategy as core
from .config import Settings
from .sources import pair_age_minutes


@dataclass
class Signal:
    strategy: str
    score: float
    why: str
    exit: dict = field(default_factory=dict)       # parámetros de salida propios (vacío = ajustes globales)


META = {
    "momentum": dict(label="Momentum", icon="🚀", color="#5eead4",
                     desc="Ruptura con presión compradora y volumen que acelera. Sube con la corriente."),
    "dip": dict(label="Dip-buy", icon="🪂", color="#a78bfa",
                desc="Token que venía subiendo fuerte y cae de golpe, con compradores volviendo. Rebote rápido."),
    "volspike": dict(label="Volumen oculto", icon="🔊", color="#60a5fa",
                     desc="Volumen disparado con el precio aún plano: acumulación antes del movimiento."),
    "fresh": dict(label="Lanzamientos", icon="🌱", color="#fbbf24",
                  desc="Tokens de 5-45 min con actividad creciente, mcap pequeño y liquidez sana."),
    "trend": dict(label="Tendencia", icon="🌊", color="#34d399",
                  desc="Subida sostenida en 1h, 6h y 24h con volumen constante. Operación más larga."),
}
KEYS = list(META)


def _n(x, d=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def _c(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def _f(pair: dict) -> dict:
    tx = pair.get("txns") or {}
    vol = pair.get("volume") or {}
    pc = pair.get("priceChange") or {}
    g = lambda d, k: d.get(k) or {}
    b = lambda k: g(tx, k).get("buys", 0)
    s = lambda k: g(tx, k).get("sells", 0)
    return dict(
        c5=_n(pc.get("m5")), c1=_n(pc.get("h1")), c6=_n(pc.get("h6")), c24=_n(pc.get("h24")),
        v5=_n(vol.get("m5")), v1=_n(vol.get("h1")), v6=_n(vol.get("h6")),
        b5=b("m5"), s5=s("m5"), b1=b("h1"), s1=s("h1"),
        liq=_n((pair.get("liquidity") or {}).get("usd")), mc=_n(pair.get("marketCap") or pair.get("fdv")),
        age=pair_age_minutes(pair),
    )


def momentum(pair, s: Settings) -> Signal | None:
    ok, _ = core.check_entry(pair, s, core.score_market(pair)[0])
    if not ok:
        return None
    sc = core.score_market(pair)[0]
    return Signal("momentum", sc, "ruptura con presión compradora") if sc >= s.min_score - 8 else None


def dip(pair, s: Settings) -> Signal | None:
    f = _f(pair)
    if f["age"] is None or f["age"] < 30 or f["liq"] < 10000 or f["mc"] < s.min_mcap_usd:
        return None
    if f["c6"] < 30 and f["c24"] < 60:                 # necesita fuerza previa
        return None
    if not (f["c5"] <= -3 or f["c1"] <= -10) or f["c1"] < -35:   # cae, pero no es un cuchillo cayendo
        return None
    r5 = f["b5"] / max(f["s5"], 1)
    if f["b5"] + f["s5"] < 12 or r5 < 1.1:             # y los compradores vuelven
        return None
    sc = 40 + 15 * _c(f["c6"] / 100) + 25 * _c((r5 - 1.1) / 1.0) + 10 * _c(-f["c1"] / 25)
    return Signal("dip", sc, f"caída {f['c1']:.0f}% 1h con compradores volviendo",
                  dict(sl=12, tp1=10, tp1_frac=0.5, tp2=25, trail=6, hold=30, stag=8, stag_band=3))


def volspike(pair, s: Settings) -> Signal | None:
    f = _f(pair)
    if f["liq"] < 8000 or f["mc"] < s.min_mcap_usd or f["v5"] < 800:
        return None
    accel = f["v5"] * 12 / max(f["v1"], 1)
    r5 = f["b5"] / max(f["s5"], 1)
    if accel < 4 or abs(f["c5"]) > 3 or r5 < 1.3 or f["b5"] + f["s5"] < 10:
        return None
    sc = 40 + 30 * _c((accel - 4) / 6) + 20 * _c((r5 - 1.3) / 1.5)
    return Signal("volspike", sc, f"volumen x{accel:.1f} con precio plano",
                  dict(sl=10, tp1=15, tp1_frac=0.6, tp2=35, trail=7, hold=25, stag=6, stag_band=3))


def fresh(pair, s: Settings) -> Signal | None:
    f = _f(pair)
    if f["age"] is None or not (5 <= f["age"] <= 45) or f["liq"] < 6000 or not (10000 <= f["mc"] <= 250000):
        return None
    tx1 = f["b1"] + f["s1"]
    r1 = f["b1"] / max(f["s1"], 1)
    if tx1 < 120 or r1 < 1.15 or not (0 <= f["c1"] <= 300):
        return None
    sc = 40 + 20 * _c(tx1 / 600) + 20 * _c((r1 - 1.15) / 0.8) + 10 * _c((f["liq"] / f["mc"]) / 0.15)
    return Signal("fresh", sc, f"lanzamiento de {f['age']:.0f} min, {tx1} txns/h",
                  dict(sl=20, tp1=30, tp1_frac=0.5, tp2=100, trail=12, hold=20, stag=5, stag_band=4))


def trend(pair, s: Settings) -> Signal | None:
    f = _f(pair)
    if f["age"] is None or f["age"] < 240 or f["liq"] < 20000 or f["mc"] < s.min_mcap_usd:
        return None
    if not (3 <= f["c1"] <= 60 and 10 <= f["c6"] <= 250 and f["c24"] > 0):
        return None
    if f["v1"] * 6 < f["v6"] * 0.6 or f["b1"] / max(f["s1"], 1) < 1.05:
        return None
    sc = 40 + 20 * _c(f["c1"] / 30) + 20 * _c(f["c6"] / 120) + 10 * _c(f["v1"] * 6 / max(f["v6"], 1) / 2)
    return Signal("trend", sc, f"+{f['c1']:.0f}% 1h · +{f['c6']:.0f}% 6h · +{f['c24']:.0f}% 24h",
                  dict(sl=15, tp1=25, tp1_frac=0.4, tp2=70, trail=12, hold=120, stag=20, stag_band=4))


FUNCS = {"momentum": momentum, "dip": dip, "volspike": volspike, "fresh": fresh, "trend": trend}


def evaluate_all(pair: dict, s: Settings, enabled: set[str]) -> list[Signal]:
    out = []
    for k in KEYS:
        if k in enabled:
            sig = FUNCS[k](pair, s)
            if sig:
                out.append(sig)
    return out
