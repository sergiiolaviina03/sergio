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
