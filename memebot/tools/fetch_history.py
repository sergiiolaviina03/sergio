"""Descarga velas de 1 minuto (GeckoTerminal, gratis) de pools de Solana para backtests.
Uso: python tools/fetch_history.py salida.json [max_pools]   (respeta el límite de ~30 peticiones/min)"""
import json, sys, time
import httpx

G = "https://api.geckoterminal.com/api/v2/networks/solana"
SOURCES = [("trending_pools?duration=1h&page=1", "trending"), ("trending_pools?duration=1h&page=2", "trending"),
           ("trending_pools?duration=6h&page=1", "trending"), ("trending_pools?duration=24h&page=1", "trending"),
           ("new_pools?page=1", "new"), ("new_pools?page=2", "new"), ("new_pools?page=3", "new"), ("new_pools?page=4", "new"),
           ("new_pools?page=5", "new"), ("pools?sort=h24_volume_usd_desc&page=1", "volume"), ("pools?sort=h24_volume_usd_desc&page=2", "volume")]


def get(c, url):
    for _ in range(4):
        r = c.get(url)
        if r.status_code == 429:
            time.sleep(35); continue
        if r.status_code == 200:
            return r.json()
        return None
    return None


def main(out, maxn=160):
    c = httpx.Client(timeout=30, headers={"User-Agent": "memebot-research/1.0"})
    pools = {}
    for path, kind in SOURCES:
        d = get(c, f"{G}/{path}"); time.sleep(2.2)
        for x in (d or {}).get("data", []):
            a = x["attributes"]
            pools.setdefault(a["address"], {"addr": a["address"], "name": a["name"], "kind": kind,
                                            "created": a.get("pool_created_at"), "liq": a.get("reserve_in_usd")})
    print(len(pools), "pools", flush=True)
    res = []
    for i, p in enumerate(list(pools.values())[:maxn]):
        d = get(c, f"{G}/pools/{p['addr']}/ohlcv/minute?aggregate=1&limit=1000&currency=usd"); time.sleep(2.2)
        lst = ((d or {}).get("data", {}).get("attributes", {}) or {}).get("ohlcv_list") or []
        if len(lst) >= 90:
            p["candles"] = sorted(lst); res.append(p)
        if i % 10 == 0:
            print(i, len(res), flush=True)
            json.dump(res, open(out, "w"))
    json.dump(res, open(out, "w")); print("listo", len(res), flush=True)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 160)
