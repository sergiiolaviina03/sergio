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
    """Ajustes de estrategia. Se guardan en la BD y se editan desde el dashboard.
    Los valores por defecto son el perfil «Degen»: más riesgo, más operaciones, salidas cortas."""

    # tamaño y riesgo
    position_size_sol: float = _f("POSITION_SIZE_SOL", 0.05)    # tamaño BASE (convicción baja)
    size_mult_max: float = 3.0                                  # con convicción máxima entra hasta x veces el base
    max_open_positions: int = int(_f("MAX_OPEN_POSITIONS", 30))
    max_exposure_sol: float = _f("MAX_EXPOSURE_SOL", 2.0)       # SOL máximos invertidos a la vez
    max_daily_loss_sol: float = _f("MAX_DAILY_LOSS_SOL", 1.0)
    slippage_bps: int = 500
    # convicción (puntuación 0-100 por señales de mercado + seguridad)
    min_score: float = 42.0                                     # por debajo no entra
    # refuerzo: añade a una posición que va bien y sigue con fuerza
    scale_in_enabled: bool = True
    scale_in_trigger_pct: float = 7.0
    scale_in_min_score: float = 65.0
    scale_in_size_mult: float = 1.5                             # x tamaño base
    # filtros de entrada
    min_liquidity_usd: float = 5000
    min_age_minutes: float = 3
    max_age_minutes: float = 10080
    min_volume_h1_usd: float = 2000
    min_txns_h1: int = 25
    min_buy_sell_ratio_m5: float = 1.0
    min_price_change_m5: float = -2.0     # %
    max_price_change_h1: float = 500.0    # % (evita comprar tras pumps enormes)
    max_top10_holders_pct: float = 40.0
    max_single_holder_pct: float = 18.0
    max_rugcheck_score: int = 2500        # RugCheck: más bajo = más seguro
    require_no_mint_authority: bool = True
    require_no_freeze_authority: bool = True
    min_mcap_usd: float = 8000
    max_mcap_usd: float = 8_000_000
    # salidas (cortas)
    stop_loss_pct: float = 18.0
    take_profit_1_pct: float = 14.0       # vende tp1_sell_frac de la posición
    tp1_sell_frac: float = 0.6
    take_profit_2_pct: float = 45.0       # vende el resto
    trailing_stop_pct: float = 9.0        # se activa tras TP1, desde el máximo
    max_hold_minutes: float = 25
    stagnation_minutes: float = 6         # si no se mueve en este tiempo, libera el capital
    stagnation_band_pct: float = 4.0
    momentum_fade_ratio: float = 0.7      # compras/ventas 5m por debajo de esto con ganancia -> asegura
    min_liquidity_exit_usd: float = 2500  # si la liquidez cae por debajo: salir ya
    # bucle
    scan_interval_s: int = 5
    monitor_interval_s: int = 2

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
