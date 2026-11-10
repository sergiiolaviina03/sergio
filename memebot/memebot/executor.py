"""Ejecutores: PaperExecutor (simulación realista) y JupiterExecutor (dinero real)."""
from __future__ import annotations

import base64
from dataclasses import dataclass

from . import db, sources
from .config import SOL_MINT, Settings, env

JUP = "https://lite-api.jup.ag/swap/v1"
# Coste simulado por operación: comisión de pool + impacto + slippage típico en memecoins
PAPER_COST = 0.02


@dataclass
class Fill:
    ok: bool
    tokens: float = 0.0      # tokens comprados / vendidos
    sol: float = 0.0         # SOL gastados / recibidos
    price: float = 0.0       # USD por token
    tx: str = ""
    error: str = ""


class PaperExecutor:
    mode = "paper"

    def balance_sol(self) -> float:
        return float(db.kv_get("paper_balance", env.paper_start_balance))

    def _set_balance(self, v: float) -> None:
        db.kv_set("paper_balance", v)

    async def buy(self, mint: str, price_usd: float, sol: float, s: Settings) -> Fill:
        bal = self.balance_sol()
        if sol > bal:
            return Fill(False, error="saldo simulado insuficiente")
        sp = await sources.sol_price_usd()
        if sp <= 0 or price_usd <= 0:
            return Fill(False, error="sin precio")
        tokens = (sol * sp / price_usd) * (1 - PAPER_COST)
        self._set_balance(bal - sol)
        return Fill(True, tokens=tokens, sol=sol, price=price_usd, tx="paper")

    async def sell(self, mint: str, tokens: float, price_usd: float, s: Settings) -> Fill:
        sp = await sources.sol_price_usd()
        if sp <= 0:
            return Fill(False, error="sin precio SOL")
        sol = tokens * price_usd / sp * (1 - PAPER_COST)
        self._set_balance(self.balance_sol() + sol)
        return Fill(True, tokens=tokens, sol=sol, price=price_usd, tx="paper")


class JupiterExecutor:
    """Swaps reales vía Jupiter. SOLO se instancia si env.live_enabled."""

    mode = "live"

    def __init__(self) -> None:
        import base58
        from solders.keypair import Keypair

        self.kp = Keypair.from_bytes(base58.b58decode(env.wallet_private_key))
        self.pubkey = str(self.kp.pubkey())

    async def balance_sol(self) -> float:
        r = await sources.client().post(
            env.rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [self.pubkey]},
        )
        return r.json()["result"]["value"] / 1e9

    async def _token_balance(self, mint: str) -> tuple[int, int]:
        r = await sources.client().post(
            env.rpc_url,
            json={
                "jsonrpc": "2.0", "id": 1, "method": "getTokenAccountsByOwner",
                "params": [self.pubkey, {"mint": mint}, {"encoding": "jsonParsed"}],
            },
        )
        total, dec = 0, 0
        for a in r.json()["result"]["value"]:
            ta = a["account"]["data"]["parsed"]["info"]["tokenAmount"]
            total += int(ta["amount"])
            dec = ta["decimals"]
        return total, dec

    async def _decimals(self, mint: str) -> int:
        r = await sources.client().post(
            env.rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": "getTokenSupply", "params": [mint]},
        )
        return int(r.json()["result"]["value"]["decimals"])

    async def _swap(self, in_mint: str, out_mint: str, amount: int, s: Settings) -> dict:
        from solders.transaction import VersionedTransaction

        c = sources.client()
        q = await c.get(
            f"{JUP}/quote",
            params={"inputMint": in_mint, "outputMint": out_mint, "amount": amount,
                    "slippageBps": s.slippage_bps},
        )
        q.raise_for_status()
        quote = q.json()
        sw = await c.post(
            f"{JUP}/swap",
            json={
                "quoteResponse": quote, "userPublicKey": self.pubkey,
                "wrapAndUnwrapSol": True, "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {"priorityLevelWithMaxLamports": {
                    "maxLamports": 2_000_000, "priorityLevel": "high"}},
            },
        )
        sw.raise_for_status()
        raw = base64.b64decode(sw.json()["swapTransaction"])
        vt = VersionedTransaction.from_bytes(raw)
        signed = VersionedTransaction(vt.message, [self.kp])
        r = await c.post(
            env.rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": "sendTransaction",
                  "params": [base64.b64encode(bytes(signed)).decode(),
                             {"encoding": "base64", "skipPreflight": False, "maxRetries": 3}]},
        )
        j = r.json()
        if "error" in j:
            raise RuntimeError(str(j["error"])[:300])
        return {"sig": j["result"], "quote": quote}

    async def buy(self, mint: str, price_usd: float, sol: float, s: Settings) -> Fill:
        try:
            res = await self._swap(SOL_MINT, mint, int(sol * 1e9), s)
            dec = await self._decimals(mint)
            tokens = int(res["quote"]["outAmount"]) / 10**dec
            return Fill(True, tokens=tokens, sol=sol, price=price_usd, tx=res["sig"])
        except Exception as e:  # noqa: BLE001
            return Fill(False, error=str(e)[:200])

    async def sell(self, mint: str, tokens: float, price_usd: float, s: Settings) -> Fill:
        try:
            bal, dec = await self._token_balance(mint)
            amount = min(int(tokens * 10**dec), bal)
            if amount <= 0:
                return Fill(False, error="sin tokens en wallet")
            res = await self._swap(mint, SOL_MINT, amount, s)
            return Fill(True, tokens=amount / 10**dec, sol=int(res["quote"]["outAmount"]) / 1e9,
                        price=price_usd, tx=res["sig"])
        except Exception as e:  # noqa: BLE001
            return Fill(False, error=str(e)[:200])


def make_executor():
    if env.live_enabled:
        return JupiterExecutor()
    return PaperExecutor()
