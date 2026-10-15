from app.core.config import Settings


def test_health_retorna_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_openapi_disponivel(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"] == "EUNIS API"


def test_cors_permite_origem_configurada(client):
    resp = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_bloqueia_origem_desconhecida(client):
    resp = client.get("/health", headers={"Origin": "http://malicioso.example"})
    assert "access-control-allow-origin" not in resp.headers


def test_cors_origins_aceita_lista_separada_por_virgula():
    s = Settings(cors_origins="http://a.test, http://b.test ,")
    assert s.cors_origins_list == ["http://a.test", "http://b.test"]
