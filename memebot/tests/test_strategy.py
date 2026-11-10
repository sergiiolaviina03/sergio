import time
from memebot.config import Settings
from memebot import strategy

S = Settings()


def good_pair():
    return {
        "priceUsd": "0.001", "marketCap": 200000,
        "pairCreatedAt": (time.time() - 60 * 60) * 1000,
        "liquidity": {"usd": 50000}, "volume": {"h1": 40000},
        "txns": {"h1": {"buys": 200, "sells": 150}, "m5": {"buys": 30, "sells": 20}},
        "priceChange": {"m5": 2, "h1": 30},
    }


def test_entry_ok():
    assert strategy.check_entry(good_pair(), S) == (True, "ok")


def test_entry_rejections():
    for mut, key in [
        (lambda p: p["liquidity"].update(usd=100), "liquidez"),
        (lambda p: p.update(pairCreatedAt=time.time() * 1000), "edad"),
        (lambda p: p["txns"]["m5"].update(buys=5, sells=40), "ratio"),
        (lambda p: p["priceChange"].update(h1=9000), "subió"),
        (lambda p: p.update(marketCap=1), "mcap"),
    ]:
        p = good_pair(); mut(p)
        ok, why = strategy.check_entry(p, S)
        assert not ok and key in why, (key, why)


def test_rugcheck_excludes_pool_from_holders():
    rep = {"mintAuthority": None, "freezeAuthority": None, "score_normalised": 1, "risks": [],
           "markets": [{"pubkey": "POOL", "liquidityA": "VAULT"}],
           "topHolders": [{"address": "VAULT", "pct": 60}, {"address": "a", "owner": "o", "pct": 5}]}
    assert strategy.check_rugcheck(rep, S) == (True, "ok")
    rep["topHolders"][1]["pct"] = 40
    assert not strategy.check_rugcheck(rep, S)[0]


def test_rugcheck_authorities_and_missing():
    assert not strategy.check_rugcheck(None, S)[0]
    assert not strategy.check_rugcheck({"mintAuthority": "x"}, S)[0]
    assert not strategy.check_rugcheck({"freezeAuthority": "x"}, S)[0]
    assert not strategy.check_rugcheck({"risks": [{"level": "danger", "name": "Rugged"}]}, S)[0]


def pos(**kw):
    d = dict(entry_price=1.0, peak_price=1.0, tp1_done=0, opened_at=time.time())
    d.update(kw); return d


def test_exits():
    now = time.time()
    assert strategy.check_exit(pos(), 0.7, 20000, now, S) == ("stop_loss", 1.0)
    assert strategy.check_exit(pos(), 1.7, 20000, now, S) == ("take_profit_1", S.tp1_sell_frac)
    assert strategy.check_exit(pos(), 1.1, 1000, now, S) == ("liquidez_cae", 1.0)
    assert strategy.check_exit(pos(), 1.1, 20000, now, S) is None
    p = pos(tp1_done=1, peak_price=2.0)
    assert strategy.check_exit(p, 1.5, 20000, now, S) == ("trailing_stop", 1.0)
    assert strategy.check_exit(pos(tp1_done=1, peak_price=3.1), 3.1, 20000, now, S) == ("take_profit_2", 1.0)
    assert strategy.check_exit(pos(opened_at=now - 9999 * 60), 1.0, 20000, now, S)[0] == "tiempo_maximo"
