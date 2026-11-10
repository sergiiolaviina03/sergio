"""Configuración: .env (secretos / modo) + ajustes de estrategia editables desde el dashboard."""
from __future__ import annotations

import os
from dataclasses import dataclass, asdict, fields

from dotenv import load_dotenv

load_dotenv()

SOL_MINT = "So11111111111111111111111111111111111111112"
DB_PATH = os.getenv("DB_PATH", "memebot.db")


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return float(default)


@dataclass
class Env:
    mode: str = os.getenv("MODE", "paper").lower()
    live_confirm: str = os.getenv("LIVE_CONFIRM", "")
    wallet_private_key: str = os.getenv("WALLET_PRIVATE_KEY", "")
    rpc_url: str = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    dashboard_password: str = os.getenv("DASHBOARD_PASSWORD", "")
    session_secret: str = os.getenv("SESSION_SECRET", "")
    paper_start_balance: float = _f("PAPER_START_BALANCE_SOL", 5)

    @property
    def live_enabled(self) -> bool:
        return (
            self.mode == "live"
            and self.live_confirm == "YES_I_ACCEPT_THE_RISK"
            and bool(self.wallet_private_key)
        )


@dataclass
class Settings:
    """Ajustes de estrategia. Se guardan en la BD y se editan desde el dashboard."""

    # tamaño y riesgo
    position_size_sol: float = _f("POSITION_SIZE_SOL", 0.05)
    max_open_positions: int = int(_f("MAX_OPEN_POSITIONS", 5))
    max_daily_loss_sol: float = _f("MAX_DAILY_LOSS_SOL", 0.3)
    slippage_bps: int = 300
    # filtros de entrada
    min_liquidity_usd: float = 15000
    min_age_minutes: float = 10
    max_age_minutes: float = 2880
    min_volume_h1_usd: float = 10000
    min_txns_h1: int = 80
    min_buy_sell_ratio_m5: float = 1.1
    min_price_change_m5: float = 0.0      # %
    max_price_change_h1: float = 400.0    # % (evita comprar tras pumps enormes)
    max_top10_holders_pct: float = 35.0
    max_single_holder_pct: float = 15.0
    max_rugcheck_score: int = 2000        # RugCheck: más bajo = más seguro
    require_no_mint_authority: bool = True
    require_no_freeze_authority: bool = True
    min_mcap_usd: float = 30000
    max_mcap_usd: float = 5_000_000
    # salidas
    stop_loss_pct: float = 25.0
    take_profit_1_pct: float = 60.0       # vende tp1_sell_frac de la posición
    tp1_sell_frac: float = 0.5
    take_profit_2_pct: float = 200.0      # vende el resto
    trailing_stop_pct: float = 20.0       # se activa tras TP1, desde el máximo
    max_hold_minutes: float = 240
    min_liquidity_exit_usd: float = 3000  # si la liquidez cae por debajo: salir ya
    # bucle
    scan_interval_s: int = 20
    monitor_interval_s: int = 8

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Settings":
        s = cls()
        for f in fields(cls):
            if f.name in d:
                try:
                    setattr(s, f.name, type(getattr(s, f.name))(d[f.name]))
                except (TypeError, ValueError):
                    pass
        return s


env = Env()
