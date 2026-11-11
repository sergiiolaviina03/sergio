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


GECKO = "https://api.geckoterminal.com/api/v2/networks/solana"
# Fuentes de GeckoTerminal; se consultan por turnos (límite gratuito ~30 peticiones/min)
GECKO_SOURCES = [
    "trending_pools?duration=5m", "trending_pools?duration=1h", "new_pools?page=1", "pools?sort=h24_volume_usd_desc&page=1",
    "trending_pools?duration=6h", "new_pools?page=2", "trending_pools?duration=24h", "new_pools?page=3",
    "pools?sort=h24_volume_usd_desc&page=2", "new_pools?page=4",
]
DEX_SOURCES = [
    "/token-profiles/latest/v1", "/token-boosts/latest/v1", "/token-boosts/top/v1",
    "/community-takeovers/latest/v1", "/ads/latest/v1",
]
SEARCH_TERMS = ["pump", "meme", "dog", "cat", "pepe", "ai", "trump", "moon", "inu", "baby", "frog", "sol", "coin", "elon", "wif", "bonk"]
_gecko_i = 0
_search_i = 0


async def discover_candidates() -> list[str]:
    """Mints de Solana desde ~15 fuentes: DexScreener (5 listas) + GeckoTerminal (2 por ciclo, rotando)."""
    global _gecko_i
    picks = [GECKO_SOURCES[(_gecko_i + k) % len(GECKO_SOURCES)] for k in range(2)]
    _gecko_i = (_gecko_i + 2) % len(GECKO_SOURCES)
    global _search_i
    term = SEARCH_TERMS[_search_i % len(SEARCH_TERMS)]
    _search_i += 1
    results = await asyncio.gather(*(_get(DEX + u) for u in DEX_SOURCES), *(_gecko(k) for k in picks),
                                   _get(f"{DEX}/latest/dex/search?q={term}"),
                                   _get(f"{RUG}/stats/new_tokens"), _get(f"{RUG}/stats/recent"))
    mints: list[str] = []
    for it in (results[-3] or {}).get("pairs", []):          # búsqueda por palabra (pares de Solana)
        if it.get("chainId") == "solana" and (it.get("baseToken") or {}).get("address"):
            mints.append(it["baseToken"]["address"])
    for lst in results[-2:]:                                  # RugCheck: recién creados / más vistos
        mints += [x["mint"] for x in lst or [] if isinstance(x, dict) and x.get("mint")]
    for res in results[len(DEX_SOURCES):len(DEX_SOURCES) + 2]:
        mints += res                      # GeckoTerminal primero (trending / nuevos)
    for res in results[: len(DEX_SOURCES)]:
        for it in res or []:
            if it.get("chainId") == "solana" and it.get("tokenAddress"):
                mints.append(it["tokenAddress"])
    return list(dict.fromkeys(mints))


_gecko_pause_until = 0.0


async def _gecko(path: str) -> list[str]:
    """GeckoTerminal con freno: si responde 429 (límite), se pausa 45 s en vez de insistir."""
    global _gecko_pause_until
    if time.time() < _gecko_pause_until:
        return []
    data = None
    try:
        r = await client().get(f"{GECKO}/{path}")
        if r.status_code == 429:
            _gecko_pause_until = time.time() + 45
        elif r.status_code == 200:
            data = r.json()
    except (httpx.HTTPError, ValueError):
        pass
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


async def get_pairs(mints: list[str], prefer: dict[str, str] | None = None) -> dict[str, dict]:
    """Mejor par por mint (hasta 30 mints por petición). Con `prefer` {mint: pairAddress}
    se usa ese pool concreto si existe, para que el precio no salte entre pools."""
    out: dict[str, dict] = {}
    for i in range(0, len(mints), 30):
        chunk = mints[i : i + 30]
        data = await _get(f"{DEX}/tokens/v1/solana/{','.join(chunk)}")
        grouped: dict[str, list[dict]] = {}
        for p in data or []:
            grouped.setdefault((p.get("baseToken") or {}).get("address", ""), []).append(p)
        for m, ps in grouped.items():
            bp = next((p for p in ps if prefer and p.get("pairAddress") == prefer.get(m)), None) or best_pair(ps)
            if bp:
                out[m] = bp
    return out


async def rugcheck(mint: str) -> dict | None:
    return await _get(f"{RUG}/tokens/{mint}/report")


def pair_age_minutes(pair: dict) -> float | None:
    ts = pair.get("pairCreatedAt")
    return (time.time() * 1000 - ts) / 60000 if ts else None


_sol_cache: tuple[float, float] = (0.0, 0.0)


async def sol_price_usd() -> float:
    global _sol_cache
    if time.time() - _sol_cache[0] < 20 and _sol_cache[1] > 0:
        return _sol_cache[1]
    v = await _sol_price_uncached()
    if v > 0:
        _sol_cache = (time.time(), v)
    return v or _sol_cache[1]


async def _sol_price_uncached() -> float:
    data = await _get(f"{DEX}/tokens/v1/solana/So11111111111111111111111111111111111111112")
    bp = best_pair(data or [])
    try:
        return float(bp["priceUsd"]) if bp else 0.0
    except (KeyError, TypeError, ValueError):
        return 0.0
