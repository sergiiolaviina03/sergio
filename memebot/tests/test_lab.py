import json, time
import pytest
from memebot import db, lab, learner, strategies, strategy
from memebot.config import Settings


@pytest.fixture(autouse=True)
def fresh_db():
    db.reset_for_tests()


def add(strategy_key, pnl_pct, feats=None, entry=0.05):
    with db.tx() as c:
        c.execute("INSERT INTO positions(mint,symbol,mode,status,opened_at,closed_at,entry_price,entry_sol,tokens,tokens_initial,"
                  "peak_price,pnl_sol,strategy,features) VALUES('m','x','paper','closed',?,?,1,?,0,1,1,?,?,?)",
                  (time.time() - 600, time.time(), entry, entry * pnl_pct / 100, strategy_key,
                   json.dumps(feats) if feats else None))


def test_verdicts_follow_statistics():
    assert lab.stats("momentum")["verdict"] == "sin_datos"
    for i in range(35):                       # ganadoras claras y estables -> ventaja
        add("dip", 8 + (i % 3))
    assert lab.stats("dip")["verdict"] == "ventaja" and lab.live_allowed(lab.stats("dip"))
    for i in range(35):                       # pierde claramente
        add("fresh", -12 - (i % 3))
    st = lab.stats("fresh")
    assert st["verdict"] == "pierde" and not lab.live_allowed(st) and lab.weight(st) == 0.25
    for i in range(35):                       # ruidosa con media ~0 -> sin ventaja (el 0 cabe en el IC)
        add("trend", 40 if i % 2 else -39)
    assert lab.stats("trend")["verdict"] == "sin_ventaja"
    for i in range(12):
        add("volspike", 3)
    assert lab.stats("volspike")["verdict"] == "en_prueba"


def test_regime_follows_breadth():
    rows = [{"ts": time.time(), "liq": 20000, "buys": 20, "sells": 10, "c5": -3} for _ in range(20)]
    lab._breadth.update(v=0.5, n=0)
    for _ in range(12):
        reg = lab.update_regime(rows)
    assert reg["label"] == "bajista" and reg["size_mult"] < 1 and reg["score_bump"] > 0
    rows = [dict(r, c5=4) for r in rows]
    for _ in range(25):
        reg = lab.update_regime(rows)
    assert reg["label"] == "alcista"


def test_learner_stays_off_without_signal_and_on_with_signal():
    import random
    rnd = random.Random(3)
    for _ in range(60):                       # ruido puro: no debe activarse
        add("momentum", rnd.choice([-10, 10]), [rnd.uniform(-1, 1) for _ in learner.NAMES])
    st = learner.maybe_train()
    assert st["n"] == 60 and not st["active"]
    db.reset_for_tests()
    for _ in range(80):                       # señal real en la 1ª característica: debe activarse
        x = [rnd.uniform(-1, 1) for _ in learner.NAMES]
        add("momentum", 10 if x[0] > 0.1 else -10, x)
    st = learner.maybe_train()
    assert st["active"] and st["auc"] > 0.8
    hi = learner.adjust([1] + [0] * (len(learner.NAMES) - 1))
    lo = learner.adjust([-1] + [0] * (len(learner.NAMES) - 1))
    assert hi > 0 > lo


def test_each_strategy_fires_on_its_pattern():
    s = Settings()
    now = time.time() * 1000
    base = dict(priceUsd="0.001", marketCap=100000, liquidity={"usd": 40000}, pairCreatedAt=now - 600 * 60000,
                volume={"m5": 1000, "h1": 12000, "h6": 70000}, txns={"m5": {"buys": 20, "sells": 10}, "h1": {"buys": 300, "sells": 200}},
                priceChange={"m5": 0, "h1": 0, "h6": 0, "h24": 0})
    dip = json.loads(json.dumps(base)); dip["priceChange"] = {"m5": -5, "h1": -15, "h6": 60, "h24": 120}
    dip["txns"]["m5"] = {"buys": 30, "sells": 15}
    assert strategies.dip(dip, s) and strategies.dip(base, s) is None
    vs = json.loads(json.dumps(base)); vs["volume"]["m5"] = 6000; vs["txns"]["m5"] = {"buys": 30, "sells": 12}
    assert strategies.volspike(vs, s) and strategies.volspike(base, s) is None
    fr = json.loads(json.dumps(base)); fr["pairCreatedAt"] = now - 20 * 60000; fr["marketCap"] = 60000
    fr["txns"]["h1"] = {"buys": 260, "sells": 140}; fr["priceChange"]["h1"] = 40
    assert strategies.fresh(fr, s) and strategies.fresh(base, s) is None
    tr = json.loads(json.dumps(base)); tr["priceChange"] = {"m5": 1, "h1": 15, "h6": 60, "h24": 90}
    tr["volume"] = {"m5": 2000, "h1": 15000, "h6": 60000}
    assert strategies.trend(tr, s) and strategies.trend(base, s) is None
    # parámetros de salida propios llegan a check_exit
    sig = strategies.dip(dip, s)
    pos = dict(entry_price=1.0, peak_price=1.0, tp1_done=0, opened_at=time.time(), params=json.dumps(sig.exit))
    assert strategy.check_exit(pos, 0.87, 20000, time.time(), s)[0] == "stop_loss"       # SL 12% propio (global: 18%)
