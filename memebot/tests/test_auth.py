import os
import pytest
from fastapi.testclient import TestClient

os.environ["DASHBOARD_PASSWORD"] = ""


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from memebot import app as appmod, db
    monkeypatch.setattr(appmod.env, "dashboard_password", "")
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    db._conn = None
    with TestClient(appmod.app, base_url="http://127.0.0.1", client=("127.0.0.1", 5000)) as c:
        yield c


def test_first_run_setup_then_login(client):
    assert client.get("/api/auth-status").json() == {"needs_setup": True, "authed": False}
    assert client.get("/api/state").status_code == 401
    assert client.post("/api/setup", json={"password": "123"}).status_code == 400      # muy corta
    assert client.post("/api/login", json={"password": "loquesea"}).status_code == 401  # sin crear aún
    assert client.post("/api/setup", json={"password": "secreta1"}).status_code == 200
    assert client.get("/api/state").status_code == 200                                  # ya autenticado
    assert client.post("/api/setup", json={"password": "otra-cosa"}).status_code == 409  # no se puede pisar
    client.cookies.clear()
    assert client.post("/api/login", json={"password": "mala"}).status_code == 401
    assert client.post("/api/login", json={"password": "secreta1"}).status_code == 200
    st = client.get("/api/state").json()
    assert "radar" in st and "equity" in st


def test_setup_refused_from_remote(tmp_path, monkeypatch):
    from memebot import app as appmod, db
    monkeypatch.setattr(appmod.env, "dashboard_password", "")
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t2.db"))
    db._conn = None
    with TestClient(appmod.app, base_url="http://192.168.1.50", client=("192.168.1.50", 5000)) as c:
        assert c.post("/api/setup", json={"password": "secreta1"}).status_code == 403
