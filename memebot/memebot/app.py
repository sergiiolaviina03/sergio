"""Dashboard web (FastAPI): login, estado en vivo, ajustes, control del bot."""
from __future__ import annotations

import hmac
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from itsdangerous import BadSignature, TimestampSigner
from pydantic import BaseModel

from . import db, sources
from .config import Settings, env
from .engine import Engine

STATIC = Path(__file__).parent / "static"
_secret = env.session_secret or secrets.token_hex(32)
signer = TimestampSigner(_secret)
engine: Engine | None = None
_fails: dict[str, list[float]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    if not env.dashboard_password or env.dashboard_password == "cambia-esto":
        raise SystemExit("Define DASHBOARD_PASSWORD en .env (distinta de 'cambia-esto').")
    db.conn()
    engine = Engine()
    if db.kv_get("autostart", False):
        engine.start()
    yield
    if engine:
        engine.stop()


app = FastAPI(title="MemeBot", lifespan=lifespan)


def auth(request: Request) -> None:
    tok = request.cookies.get("session", "")
    try:
        signer.unsign(tok, max_age=60 * 60 * 24 * 7)
    except BadSignature:
        raise HTTPException(401, "no autenticado")


class Login(BaseModel):
    password: str


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    ip = request.client.host if request.client else "?"
    recent = [t for t in _fails.get(ip, []) if time.time() - t < 600]
    if len(recent) >= 5:
        raise HTTPException(429, "demasiados intentos, espera 10 minutos")
    if not hmac.compare_digest(body.password.encode(), env.dashboard_password.encode()):
        _fails[ip] = recent + [time.time()]
        raise HTTPException(401, "contraseña incorrecta")
    response.set_cookie("session", signer.sign(b"ok").decode(), httponly=True, samesite="strict",
                        max_age=60 * 60 * 24 * 7)
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}


@app.get("/api/state", dependencies=[Depends(auth)])
async def state():
    s = db.load_settings()
    assert engine
    ex = engine.executor
    bal = await ex.balance_sol() if env.live_enabled else ex.balance_sol()
    open_pos = engine.open_positions()
    closed = [dict(r) for r in db.q("SELECT * FROM positions WHERE status='closed' ORDER BY closed_at DESC LIMIT 100")]
    all_closed = db.q("SELECT pnl_sol FROM positions WHERE status='closed'")
    wins = sum(1 for r in all_closed if r["pnl_sol"] > 0)
    for p in open_pos:
        e = p["entry_price"]
        p["sl_price"] = e * (1 - s.stop_loss_pct / 100)
        p["tp1_price"] = e * (1 + s.take_profit_1_pct / 100)
        p["tp2_price"] = e * (1 + s.take_profit_2_pct / 100)
        p["trail_price"] = p["peak_price"] * (1 - s.trailing_stop_pct / 100) if p["tp1_done"] else None
        lp = p["last_price"] or p["entry_price"]
        p["value_sol"] = p["realized_sol"] + (p["entry_sol"] * (p["tokens"] / p["tokens_initial"]) * (lp / p["entry_price"]))
        p["pnl_pct"] = (lp / p["entry_price"] - 1) * 100
    equity, acc = [], 0.0
    for r in reversed(closed):
        acc += r["pnl_sol"]
        equity.append({"time": int(r["closed_at"]), "value": round(acc, 6)})
    best = max((r["pnl_sol"] for r in all_closed), default=None)
    worst = min((r["pnl_sol"] for r in all_closed), default=None)
    return {
        "sol_price": await sources.sol_price_usd(), "equity": equity, "best": best, "worst": worst,
        "mode": ex.mode, "live_possible": env.live_enabled,
        "running": engine.running, "halted_reason": engine.halted_reason,
        "balance_sol": bal, "daily_pnl_sol": engine.daily_pnl(),
        "total_pnl_sol": sum(r["pnl_sol"] for r in all_closed),
        "trades_closed": len(all_closed), "win_rate": (wins / len(all_closed) * 100) if all_closed else None,
        "stats": engine.stats, "last_scan": engine.last_scan,
        "open": open_pos, "closed": closed, "settings": s.to_dict(),
        "log": [dict(r) for r in db.q("SELECT ts,level,msg FROM log ORDER BY id DESC LIMIT 60")],
        "recent_rejections": [dict(r) for r in db.q(
            "SELECT mint,verdict,ts FROM seen WHERE verdict!='ok' ORDER BY ts DESC LIMIT 15")],
    }


@app.get("/api/ticks/{pid}", dependencies=[Depends(auth)])
def ticks(pid: int, since: int = 0):
    rows = db.q("SELECT ts,price FROM ticks WHERE position_id=? AND ts>? ORDER BY ts LIMIT 5000", (pid, since))
    tr = [dict(r) for r in db.q(
        "SELECT ts,side,price,reason FROM trades WHERE position_id=? ORDER BY ts", (pid,))]
    return {"ticks": [{"time": r["ts"], "value": r["price"]} for r in rows], "trades": tr}


@app.post("/api/start", dependencies=[Depends(auth)])
async def start():
    assert engine
    engine.start()
    db.kv_set("autostart", True)
    return {"ok": True}


@app.post("/api/stop", dependencies=[Depends(auth)])
async def stop():
    assert engine
    engine.stop()
    db.kv_set("autostart", False)
    return {"ok": True}


@app.post("/api/settings", dependencies=[Depends(auth)])
async def save_settings(request: Request):
    data = await request.json()
    s = Settings.from_dict(data)
    if not (0 < s.position_size_sol <= 10) or s.stop_loss_pct <= 0 or s.max_open_positions < 1:
        raise HTTPException(400, "valores no válidos")
    db.save_settings(s)
    return {"ok": True}


@app.post("/api/close/{pid}", dependencies=[Depends(auth)])
async def close_position(pid: int):
    assert engine
    rows = [p for p in engine.open_positions() if p["id"] == pid]
    if not rows:
        raise HTTPException(404, "posición no encontrada")
    p = rows[0]
    await engine._sell(p, p["last_price"] or p["entry_price"], "cierre_manual", 1.0, db.load_settings())
    return {"ok": True}


@app.post("/api/reset-paper", dependencies=[Depends(auth)])
async def reset_paper():
    if env.live_enabled:
        raise HTTPException(400, "solo en simulación")
    assert engine
    engine.stop()
    with db.tx() as c:
        c.execute("DELETE FROM positions"); c.execute("DELETE FROM trades"); c.execute("DELETE FROM seen")
    db.kv_set("paper_balance", env.paper_start_balance)
    return {"ok": True}


@app.get("/lightweight-charts.js")
def lw():
    return FileResponse(STATIC / "lightweight-charts.js", media_type="application/javascript")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.exception_handler(HTTPException)
async def _h(request: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
