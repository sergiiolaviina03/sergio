"""Dashboard web (FastAPI): login, estado en vivo, ajustes, control del bot."""
from __future__ import annotations

import hashlib
import os
import hmac
import secrets
import socket
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, Response as RawResponse
from itsdangerous import BadSignature, TimestampSigner
from pydantic import BaseModel

from . import db, lab, learner, sources, strategies
from .config import Settings, env
from .engine import Engine

STATIC = Path(__file__).parent / "static"
signer = TimestampSigner(env.session_secret or "placeholder")
engine: Engine | None = None
_fails: dict[str, list[float]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, signer
    db.conn()
    secret = env.session_secret or db.kv_get("session_secret")
    if not secret:                       # se genera una vez y se guarda: las sesiones sobreviven a reinicios
        secret = secrets.token_hex(32)
        db.kv_set("session_secret", secret)
    signer = TimestampSigner(secret)
    engine = Engine()
    if db.kv_get("autostart", not env.live_enabled):   # simulación: arranca sola; dinero real: lo inicias tú
        engine.start()
    yield
    if engine:
        engine.stop()


app = FastAPI(title="MemeBot", lifespan=lifespan)


def auth(request: Request) -> None:
    tok = request.cookies.get("session", "")
    try:
        signer.unsign(tok, max_age=60 * 60 * 24 * 30)
    except BadSignature:
        raise HTTPException(401, "no autenticado")


class Login(BaseModel):
    password: str


def _env_pw() -> str:
    pw = env.dashboard_password
    return "" if pw in ("", "cambia-esto") else pw


def _hash(pw: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    return salt + "$" + hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()


def _check_pw(pw: str) -> bool:
    if _env_pw():
        return hmac.compare_digest(pw.encode(), _env_pw().encode())
    stored = db.kv_get("pw_hash")
    return bool(stored) and hmac.compare_digest(_hash(pw, stored.split("$")[0]), stored)


def needs_setup() -> bool:
    return not _env_pw() and not db.kv_get("pw_hash")


def _set_cookie(response: Response) -> None:
    response.set_cookie("session", signer.sign(b"ok").decode(), httponly=True, samesite="strict",
                        max_age=60 * 60 * 24 * 30)


@app.get("/api/auth-status")
def auth_status(request: Request):
    try:
        signer.unsign(request.cookies.get("session", ""), max_age=60 * 60 * 24 * 30)
        authed = True
    except BadSignature:
        authed = False
    return {"needs_setup": needs_setup(), "authed": authed}


@app.post("/api/setup")
def setup(body: Login, request: Request, response: Response):
    """Primera vez: crea la contraseña desde el navegador (solo desde este mismo equipo)."""
    if not needs_setup():
        raise HTTPException(409, "la contraseña ya está creada")
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost") and os.getenv("ALLOW_REMOTE_SETUP") != "1":
        raise HTTPException(403, "crea la contraseña desde el propio ordenador donde corre el bot")
    if len(body.password) < 6:
        raise HTTPException(400, "mínimo 6 caracteres")
    db.kv_set("pw_hash", _hash(body.password))
    _set_cookie(response)
    return {"ok": True}


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    ip = request.client.host if request.client else "?"
    recent = [t for t in _fails.get(ip, []) if time.time() - t < 600]
    if len(recent) >= 5:
        raise HTTPException(429, "demasiados intentos, espera 10 minutos")
    if needs_setup() or not _check_pw(body.password):
        _fails[ip] = recent + [time.time()]
        raise HTTPException(401, "contraseña incorrecta")
    _set_cookie(response)
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
    cfg = engine.strategy_cfg()
    lab_stats = engine.lab_stats()
    for p in open_pos:
        p.pop("features", None)
    for c in closed:
        c.pop("features", None)
        c.pop("params", None)
    lab_out = {
        "strategies": [dict(key=k, **strategies.META[k], enabled=cfg[k]["enabled"], weight=lab.weight(lab_stats[k]),
                            live_ok=lab.live_allowed(lab_stats[k]), open=sum(1 for p in open_pos if p["strategy"] == k),
                            **{**lab_stats[k], "equity": lab_stats[k]["equity"][-80:]}) for k in strategies.KEYS],
        "regime": engine.regime,
        "learner": {k: v for k, v in learner.status().items() if k != "model"},
        "min_trades": lab.MIN_TRADES_VERDICT,
    }
    equity, acc = [], 0.0
    for r in reversed(closed):
        acc += r["pnl_sol"]
        equity.append({"time": int(r["closed_at"]), "value": round(acc, 6)})
    best = max((r["pnl_sol"] for r in all_closed), default=None)
    worst = min((r["pnl_sol"] for r in all_closed), default=None)
    return {
        "radar": engine.radar_list(40), "lab": lab_out,
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


@app.post("/api/live", dependencies=[Depends(auth)])
async def live(request: Request):
    """Ticks nuevos + operaciones de varias posiciones en una sola petición: {"since": {id: ts}}."""
    since = (await request.json()).get("since", {})
    out = {}
    for pid, ts in list(since.items())[:50]:
        pid = int(pid)
        rows = db.q("SELECT ts,price FROM ticks WHERE position_id=? AND ts>? ORDER BY ts LIMIT 5000", (pid, int(ts)))
        tr = [dict(r) for r in db.q("SELECT ts,side,price,reason FROM trades WHERE position_id=? ORDER BY ts", (pid,))]
        out[pid] = {"ticks": [{"time": r["ts"], "value": r["price"]} for r in rows], "trades": tr}
    return out


@app.post("/api/strategies", dependencies=[Depends(auth)])
async def set_strategy(request: Request):
    body = await request.json()
    if body.get("key") not in strategies.KEYS:
        raise HTTPException(400, "estrategia desconocida")
    cfg = db.kv_get("strategy_cfg", {})
    cfg[body["key"]] = {"enabled": bool(body.get("enabled"))}
    db.kv_set("strategy_cfg", cfg)
    return {"ok": True}


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


def _lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.connect(("10.255.255.255", 1))     # no envía nada: solo elige la interfaz de red
            return sk.getsockname()[0]
    except OSError:
        return "127.0.0.1"


@app.get("/api/mobile", dependencies=[Depends(auth)])
def mobile(request: Request):
    port = os.getenv("PORT", "8000")
    host = request.headers.get("host", "")
    # si ya entras por una dirección que no es localhost (móvil, túnel...), usa esa
    url = f"{request.url.scheme}://{host}" if host and not host.startswith(("127.", "localhost")) else f"http://{_lan_ip()}:{port}"
    svg = ""
    try:
        import segno
        svg = segno.make(url, error="m").svg_inline(scale=6, dark="#0b1020", light="#ffffff", border=2)
    except Exception:  # noqa: BLE001
        pass
    lan_open = os.getenv("HOST", "127.0.0.1") in ("0.0.0.0", "::")
    return {"url": url, "qr": svg, "lan_open": lan_open}


@app.get("/manifest.webmanifest")
def manifest():
    return JSONResponse({
        "name": "MemeBot", "short_name": "MemeBot", "start_url": "/", "display": "standalone",
        "background_color": "#070a12", "theme_color": "#070a12", "orientation": "portrait",
        "icons": [{"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}],
    }, media_type="application/manifest+json")


@app.get("/sw.js")
def sw():
    return RawResponse("self.addEventListener('install',()=>self.skipWaiting());"
                       "self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"
                       "self.addEventListener('fetch',()=>{});", media_type="application/javascript")


@app.get("/static/{name}")
def static_file(name: str):
    f = (STATIC / name).resolve()
    if f.parent != STATIC.resolve() or not f.is_file() or f.suffix not in (".png", ".svg", ".js", ".ico"):
        raise HTTPException(404, "no encontrado")
    return FileResponse(f)


@app.get("/lightweight-charts.js")
def lw():
    return FileResponse(STATIC / "lightweight-charts.js", media_type="application/javascript")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.exception_handler(HTTPException)
async def _h(request: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
