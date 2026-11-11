import asyncio
import pytest
from memebot import db, sources, engine as eng
from memebot.config import Settings


@pytest.fixture(autouse=True)
def fresh_db():
    db.reset_for_tests()


def test_paper_roundtrip(monkeypatch):
    async def sp(): return 100.0
    monkeypatch.setattr(sources, "sol_price_usd", sp)
    e = eng.Engine()
    s = Settings()
    pair = {"priceUsd": "0.01", "pairAddress": "P", "baseToken": {"symbol": "TST"}}
    start_bal = e.executor.balance_sol()

    async def run():
        await e._open("MINT", pair, s)
        pos = e.open_positions()[0]
        assert abs(pos["entry_sol"] - s.position_size_sol) < 1e-9
        # +100% -> TP1 vende la mitad
        await e._sell(pos, 0.02, "take_profit_1", 0.5, s)
        pos = e.open_positions()[0]
        assert pos["tp1_done"] == 1 and 0.49 < pos["tokens"] / pos["tokens_initial"] < 0.51
        # resto a stop
        await e._sell(pos, 0.02, "take_profit_2", 1.0, s)
    asyncio.run(run())
    assert e.open_positions() == []
    closed = db.q("SELECT * FROM positions WHERE status='closed'")[0]
    # entrada y salidas con coste 2% cada una: ~ +96% sobre lo invertido
    assert 0.9 < closed["pnl_sol"] / closed["entry_sol"] < 1.0
    assert abs(e.executor.balance_sol() - (start_bal + closed["pnl_sol"])) < 1e-9


def test_daily_loss_halts(monkeypatch):
    e = eng.Engine()
    with db.tx() as c:
        c.execute("INSERT INTO positions(mint,symbol,mode,status,opened_at,closed_at,entry_price,entry_sol,tokens,"
                  "tokens_initial,peak_price,pnl_sol) VALUES('m','x','paper','closed',?,?,1,1,0,1,1,-5)",
                  (1e9, __import__('time').time()))
    e.running = True
    asyncio.run(e.scan_once())
    assert not e.running and "pérdida" in e.halted_reason


def test_exit_needs_two_confirming_reads(monkeypatch):
    async def sp(): return 100.0
    monkeypatch.setattr(sources, "sol_price_usd", sp)
    prices = iter([0.01, 0.005, 0.01, 0.005, 0.005])  # tick falso, recupera, caída real x2

    async def fake_pairs(mints, prefer=None):
        return {mints[0]: {"priceUsd": str(next(prices)), "liquidity": {"usd": 50000}}}
    monkeypatch.setattr(sources, "get_pairs", fake_pairs)
    e = eng.Engine(); s = Settings()
    async def run():
        await e._open("M", {"priceUsd": "0.01", "pairAddress": "P", "baseToken": {"symbol": "T"}}, s)
        await e.monitor_once()            # 0.01 -> nada
        await e.monitor_once()            # 0.005 (-50%) -> pendiente
        assert len(e.open_positions()) == 1
        await e.monitor_once()            # vuelve 0.01 -> cancela pendiente
        await e.monitor_once()            # 0.005 -> pendiente de nuevo
        assert len(e.open_positions()) == 1
        await e.monitor_once()            # 0.005 confirmado -> vende
    asyncio.run(run())
    assert e.open_positions() == []


def _hot_pair(price):
    import time
    return {"priceUsd": str(price), "pairAddress": "P", "baseToken": {"symbol": "HOT"},
            "marketCap": 200000, "pairCreatedAt": (time.time() - 3600) * 1000,
            "liquidity": {"usd": 60000}, "volume": {"h1": 30000, "m5": 9000},
            "txns": {"h1": {"buys": 300, "sells": 200}, "m5": {"buys": 70, "sells": 15}},
            "priceChange": {"m5": 6, "h1": 40}}


def test_scale_in_once_and_average_price(monkeypatch):
    async def sp(): return 100.0
    monkeypatch.setattr(sources, "sol_price_usd", sp)
    e = eng.Engine(); s = Settings()

    async def run():
        await e._open("M", _hot_pair(0.01), s, s.position_size_sol, 70)
        pos = e.open_positions()[0]
        await e._maybe_scale_in(pos, _hot_pair(0.0108), 0.0108, s)     # +8%, convicción alta -> refuerzo
        pos = e.open_positions()[0]
        assert pos["adds"] == 1 and pos["entry_sol"] > s.position_size_sol
        assert 0.01 < pos["entry_price"] < 0.0108                      # precio medio ponderado
        await e._maybe_scale_in(pos, _hot_pair(0.0108), 0.0108, s)     # solo una vez
        assert e.open_positions()[0]["entry_sol"] == pos["entry_sol"]
        # sin refuerzo si la convicción es baja
        cold = _hot_pair(0.0108); cold["txns"]["m5"] = {"buys": 5, "sells": 30}
        e2 = eng.Engine()
        await e2._open("N", _hot_pair(0.01), s, s.position_size_sol, 70)
        p2 = [p for p in e2.open_positions() if p["mint"] == "N"][0]
        await e2._maybe_scale_in(p2, cold, 0.0108, s)
        assert [p for p in e2.open_positions() if p["mint"] == "N"][0]["adds"] == 0
    asyncio.run(run())


def test_scale_in_respects_exposure_cap(monkeypatch):
    async def sp(): return 100.0
    monkeypatch.setattr(sources, "sol_price_usd", sp)
    e = eng.Engine(); s = Settings(); s.max_exposure_sol = s.position_size_sol * 1.2

    async def run():
        await e._open("M", _hot_pair(0.01), s, s.position_size_sol, 70)
        await e._maybe_scale_in(e.open_positions()[0], _hot_pair(0.0108), 0.0108, s)
        assert e.open_positions()[0]["adds"] == 0
    asyncio.run(run())
