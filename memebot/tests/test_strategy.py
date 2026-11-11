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
    p = pos(tp1_done=1, peak_price=1.5)
    assert strategy.check_exit(p, 1.3, 20000, now, S) == ("trailing_stop", 1.0)
    assert strategy.check_exit(pos(tp1_done=1, peak_price=1.6), 1.6, 20000, now, S) == ("take_profit_2", 1.0)
    assert strategy.check_exit(pos(opened_at=now - 9999 * 60, tp1_done=1), 1.2, 20000, now, S)[0] == "tiempo_maximo"
    # sin movimiento tras N minutos libera el capital
    stuck = pos(opened_at=now - (S.stagnation_minutes + 1) * 60)
    assert strategy.check_exit(stuck, 1.01, 20000, now, S) == ("sin_movimiento", 1.0)
    # va ganando pero se apaga la presión compradora -> asegura
    fade = {"txns": {"m5": {"buys": 3, "sells": 20}}}
    assert strategy.check_exit(pos(), 1.08, 20000, now, S, fade) == ("momentum_perdido", 1.0)
    assert strategy.check_exit(pos(), 0.99, 20000, now, S, fade) is None   # sin ganancia no aplica


def test_score_and_sizing():
    hot = good_pair()
    hot["txns"]["m5"] = {"buys": 80, "sells": 20}
    hot["volume"]["m5"] = 20000
    hot["priceChange"]["m5"] = 8
    cold = good_pair()
    cold["txns"]["m5"] = {"buys": 10, "sells": 10}
    cold["volume"]["m5"] = 500
    cold["priceChange"]["m5"] = -5
    hs, _ = strategy.score_market(hot)
    cs, _ = strategy.score_market(cold)
    assert hs > cs + 25 and 0 <= cs <= hs <= 90
    # más convicción -> entra con más, nunca menos que la base ni más que el máximo
    lo = strategy.position_size(S.min_score, S)
    hi = strategy.position_size(90, S)
    assert abs(lo - S.position_size_sol) < 1e-9
    assert abs(hi - S.position_size_sol * S.size_mult_max) < 1e-9
    assert lo < strategy.position_size(70, S) < hi
    assert strategy.score_safety(None) == 0
    assert strategy.score_safety({"score_normalised": 1, "topHolders": []}) > 9
