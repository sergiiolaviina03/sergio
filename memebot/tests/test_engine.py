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
