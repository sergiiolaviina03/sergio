"""Filtros de entrada y reglas de salida. Funciones puras (fáciles de testear)."""
from __future__ import annotations

from .config import Settings
from .sources import pair_age_minutes


def _num(x, d=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def check_entry(pair: dict, s: Settings) -> tuple[bool, str]:
    """Filtros de mercado (sin RugCheck). Devuelve (ok, motivo)."""
    liq = _num((pair.get("liquidity") or {}).get("usd"))
    if liq < s.min_liquidity_usd:
        return False, f"liquidez {liq:.0f} < {s.min_liquidity_usd:.0f}"
    age = pair_age_minutes(pair)
    if age is None:
        return False, "sin edad"
    if not (s.min_age_minutes <= age <= s.max_age_minutes):
        return False, f"edad {age:.0f}min fuera de rango"
    vol1h = _num((pair.get("volume") or {}).get("h1"))
    if vol1h < s.min_volume_h1_usd:
        return False, f"volumen 1h {vol1h:.0f} bajo"
    tx = pair.get("txns") or {}
    h1 = tx.get("h1") or {}
    if (h1.get("buys", 0) + h1.get("sells", 0)) < s.min_txns_h1:
        return False, "pocas transacciones 1h"
    m5 = tx.get("m5") or {}
    buys, sells = m5.get("buys", 0), m5.get("sells", 0)
    if sells == 0 and buys == 0:
        return False, "sin actividad 5m"
    if (buys / max(sells, 1)) < s.min_buy_sell_ratio_m5:
        return False, f"ratio compras/ventas 5m {buys}/{sells}"
    pc = pair.get("priceChange") or {}
    if _num(pc.get("m5")) < s.min_price_change_m5:
        return False, "momentum 5m negativo"
    if _num(pc.get("h1")) > s.max_price_change_h1:
        return False, "ya subió demasiado en 1h"
    mc = _num(pair.get("marketCap") or pair.get("fdv"))
    if not (s.min_mcap_usd <= mc <= s.max_mcap_usd):
        return False, f"mcap {mc:.0f} fuera de rango"
    if _num(pair.get("priceUsd")) <= 0:
        return False, "sin precio"
    return True, "ok"


def _pool_accounts(report: dict) -> set[str]:
    """Cuentas de pools/AMM y bloqueos de liquidez: no cuentan como 'holders' reales."""
    ex: set[str] = set()
    for m in report.get("markets") or []:
        for k in ("pubkey", "liquidityA", "liquidityB", "mintLP"):
            if m.get(k):
                ex.add(m[k])
    for addr, info in (report.get("knownAccounts") or {}).items():
        if (info or {}).get("type") in ("AMM", "CREATOR_FUNDER", "LOCKER", "BURN"):
            ex.add(addr)
    for addr in (report.get("lockerOwners") or {}):
        ex.add(addr)
    return ex


def check_rugcheck(report: dict | None, s: Settings) -> tuple[bool, str]:
    if not report:
        return False, "sin informe RugCheck"
    if s.require_no_mint_authority and report.get("mintAuthority"):
        return False, "mint authority activa"
    if s.require_no_freeze_authority and report.get("freezeAuthority"):
        return False, "freeze authority activa"
    if _num(report.get("score_normalised", report.get("score")), 0) > s.max_rugcheck_score:
        return False, "score RugCheck alto"
    risks = [r for r in report.get("risks") or [] if r.get("level") == "danger"]
    if risks:
        return False, "riesgo: " + risks[0].get("name", "danger")
    excluded = _pool_accounts(report)
    pcts = [
        _num(h.get("pct"))
        for h in report.get("topHolders") or []
        if h.get("address") not in excluded and h.get("owner") not in excluded
    ]
    if pcts:
        if max(pcts) > s.max_single_holder_pct:
            return False, f"holder único {max(pcts):.1f}%"
        if sum(sorted(pcts, reverse=True)[:10]) > s.max_top10_holders_pct:
            return False, "top10 holders concentrados"
    return True, "ok"


def check_exit(pos: dict, price: float, liq_usd: float, now: float, s: Settings) -> tuple[str, float] | None:
    """Devuelve (motivo, fracción_a_vender_de_lo_restante) o None."""
    entry = pos["entry_price"]
    chg = (price / entry - 1) * 100
    peak = max(pos["peak_price"], price)
    if liq_usd and liq_usd < s.min_liquidity_exit_usd:
        return "liquidez_cae", 1.0
    if chg <= -s.stop_loss_pct:
        return "stop_loss", 1.0
    if not pos["tp1_done"]:
        if chg >= s.take_profit_1_pct:
            return "take_profit_1", s.tp1_sell_frac
    else:
        if chg >= s.take_profit_2_pct:
            return "take_profit_2", 1.0
        if price <= peak * (1 - s.trailing_stop_pct / 100):
            return "trailing_stop", 1.0
    if (now - pos["opened_at"]) / 60 >= s.max_hold_minutes:
        return "tiempo_maximo", 1.0
    return None
