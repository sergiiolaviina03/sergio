"""Datos de mercado en tiempo real: DexScreener (descubrimiento/precios) y RugCheck (seguridad)."""
from __future__ import annotations

import asyncio
import time

import httpx

DEX = "https://api.dexscreener.com"
RUG = "https://api.rugcheck.xyz/v1"

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15, headers={"User-Agent": "memebot/1.0"})
    return _client


async def _get(url: str):
    try:
        r = await client().get(url)
        if r.status_code == 200:
            return r.json()
    except (httpx.HTTPError, ValueError):
        pass
    return None


async def discover_candidates() -> list[str]:
    """Mints de Solana recién listados / con perfil / impulsados en DexScreener."""
    urls = [
        f"{DEX}/token-profiles/latest/v1",
        f"{DEX}/token-boosts/latest/v1",
        f"{DEX}/token-boosts/top/v1",
    ]
    results = await asyncio.gather(*(_get(u) for u in urls), _gecko("trending_pools"), _gecko("new_pools"))
    mints: list[str] = []
    for res in results[:3]:
        for it in res or []:
            if it.get("chainId") == "solana" and it.get("tokenAddress"):
                mints.append(it["tokenAddress"])
    mints = results[3] + results[4] + mints   # pools en tendencia / nuevos primero
    return list(dict.fromkeys(mints))


async def _gecko(kind: str) -> list[str]:
    """Mints de pools en tendencia / nuevos de Solana (GeckoTerminal, sin API key)."""
    data = await _get(f"https://api.geckoterminal.com/api/v2/networks/solana/{kind}?page=1")
    out = []
    for x in (data or {}).get("data", []):
        try:
            out.append(x["relationships"]["base_token"]["data"]["id"].removeprefix("solana_"))
        except (KeyError, TypeError):
            pass
    return out


def best_pair(pairs: list[dict]) -> dict | None:
    """Par de Solana con más liquidez."""
    sol = [p for p in pairs or [] if p.get("chainId") == "solana"]
    if not sol:
        return None
    return max(sol, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)


async def get_pairs(mints: list[str]) -> dict[str, dict]:
    """Mejor par por mint (hasta 30 mints por petición)."""
    out: dict[str, dict] = {}
    for i in range(0, len(mints), 30):
        chunk = mints[i : i + 30]
        data = await _get(f"{DEX}/tokens/v1/solana/{','.join(chunk)}")
        grouped: dict[str, list[dict]] = {}
        for p in data or []:
            grouped.setdefault((p.get("baseToken") or {}).get("address", ""), []).append(p)
        for m, ps in grouped.items():
            bp = best_pair(ps)
            if bp:
                out[m] = bp
    return out


async def rugcheck(mint: str) -> dict | None:
    return await _get(f"{RUG}/tokens/{mint}/report")


def pair_age_minutes(pair: dict) -> float | None:
    ts = pair.get("pairCreatedAt")
    return (time.time() * 1000 - ts) / 60000 if ts else None


async def sol_price_usd() -> float:
    data = await _get(f"{DEX}/tokens/v1/solana/So11111111111111111111111111111111111111112")
    bp = best_pair(data or [])
    try:
        return float(bp["priceUsd"]) if bp else 0.0
    except (KeyError, TypeError, ValueError):
        return 0.0
