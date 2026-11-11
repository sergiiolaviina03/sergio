"""SQLite: posiciones, operaciones, ajustes y estado."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from contextlib import contextmanager

from .config import DB_PATH, Settings

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL, symbol TEXT, pair TEXT,
  status TEXT NOT NULL DEFAULT 'open',          -- open | closed
  mode TEXT NOT NULL,
  opened_at REAL NOT NULL, closed_at REAL,
  entry_price REAL NOT NULL,                    -- USD por token
  entry_sol REAL NOT NULL,                      -- SOL invertidos
  tokens REAL NOT NULL,                         -- tokens restantes
  tokens_initial REAL NOT NULL,
  peak_price REAL NOT NULL,
  tp1_done INTEGER NOT NULL DEFAULT 0,
  realized_sol REAL NOT NULL DEFAULT 0,         -- SOL cobrados hasta ahora
  last_price REAL, exit_reason TEXT, pnl_sol REAL
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id INTEGER, ts REAL NOT NULL, side TEXT NOT NULL,   -- buy | sell
  mint TEXT, symbol TEXT, price REAL, tokens REAL, sol REAL,
  reason TEXT, tx TEXT, mode TEXT
);
CREATE TABLE IF NOT EXISTS ticks (
  position_id INTEGER NOT NULL, ts INTEGER NOT NULL, price REAL NOT NULL,
  PRIMARY KEY (position_id, ts)
);
CREATE TABLE IF NOT EXISTS seen (mint TEXT PRIMARY KEY, ts REAL, verdict TEXT);
CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, level TEXT, msg TEXT);
"""


def conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.executescript(SCHEMA)
            _migrate(_conn)
            _conn.commit()
        return _conn


def _migrate(c: sqlite3.Connection) -> None:
    cols = {r[1] for r in c.execute("PRAGMA table_info(positions)")}
    for name, ddl in (("image", "TEXT"), ("adds", "INTEGER NOT NULL DEFAULT 0"), ("score", "REAL"),
                      ("strategy", "TEXT NOT NULL DEFAULT 'momentum'"), ("params", "TEXT"), ("features", "TEXT")):
        if name not in cols:
            c.execute(f"ALTER TABLE positions ADD COLUMN {name} {ddl}")


def add_tick(position_id: int, price: float, ts: float | None = None) -> None:
    with tx() as c:
        c.execute("INSERT OR REPLACE INTO ticks(position_id,ts,price) VALUES(?,?,?)",
                  (position_id, int(ts or time.time()), price))


def reset_for_tests(path: str = ":memory:") -> None:
    global _conn
    with _lock:
        _conn = sqlite3.connect(path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(SCHEMA)
        _migrate(_conn)
        _conn.commit()


@contextmanager
def tx():
    with _lock:
        c = conn()
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise


def q(sql: str, args: tuple = ()) -> list[sqlite3.Row]:
    with _lock:
        return conn().execute(sql, args).fetchall()


def kv_get(k: str, default=None):
    r = q("SELECT v FROM kv WHERE k=?", (k,))
    return json.loads(r[0]["v"]) if r else default


def kv_set(k: str, v) -> None:
    with tx() as c:
        c.execute("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))


def load_settings() -> Settings:
    return Settings.from_dict(kv_get("settings", {}))


def save_settings(s: Settings) -> None:
    kv_set("settings", s.to_dict())


def log(level: str, msg: str) -> None:
    with tx() as c:
        c.execute("INSERT INTO log(ts,level,msg) VALUES(?,?,?)", (time.time(), level, msg[:500]))
        c.execute("DELETE FROM log WHERE id < (SELECT MAX(id) FROM log) - 500")
