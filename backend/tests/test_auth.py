from app.core.security import hash_password, verify_password
from tests.conftest import register


def test_hash_de_senha_nao_guarda_texto_puro():
    h = hash_password("senha1234")
    assert "senha1234" not in h
    assert verify_password("senha1234", h)
    assert not verify_password("outra", h)
    assert hash_password("senha1234") != h  # salt aleatório


def test_cadastro_abre_sessao_em_cookie_httponly(client):
    r = client.post(
        "/api/auth/register",
        json={"name": "Ana", "username": "ana", "email": "ANA@Test.dev", "password": "senha1234"},
    )
    assert r.status_code == 201
    assert r.json()["email"] == "ana@test.dev"
    assert "password_hash" not in r.json()
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").json()["user"]["username"] == "ana"


def test_cadastro_rejeita_duplicados_e_dados_invalidos(client):
    register(client, "ana")
    r = client.post(
        "/api/auth/register",
        json={"name": "Ana 2", "username": "ana2", "email": "ana@test.dev", "password": "senha1234"},
    )
    assert r.status_code == 409
    r = client.post(
        "/api/auth/register",
        json={"name": "Ana 3", "username": "ana", "email": "ana3@test.dev", "password": "senha1234"},
    )
    assert r.status_code == 409
    r = client.post(
        "/api/auth/register",
        json={"name": "Bia", "username": "bia", "email": "bia@test.dev", "password": "somenteletras"},
    )
    assert r.status_code == 422
    assert "letras e números" in r.json()["detail"]


def test_login_logout(client):
    register(client, "ana")
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").json()["user"] is None
    r = client.post("/api/auth/login", json={"email": "ana@test.dev", "password": "errada123"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"email": "ana@test.dev", "password": "senha1234"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").json()["user"]["username"] == "ana"


def test_login_limita_tentativas(client):
    register(client, "ana")
    codes = [
        client.post("/api/auth/login", json={"email": "limite@test.dev", "password": "x"}).status_code
        for _ in range(10)
    ]
    assert codes[-1] == 429


def test_rotas_protegidas_exigem_login(client):
    assert client.get("/api/feed").status_code == 401
    assert client.put("/api/titles/1/review", json={"rating": 8}).status_code == 401
    assert client.patch("/api/auth/me", json={"bio": "x"}).status_code == 401


def test_token_invalido_nao_autentica(client):
    client.cookies.set("eunis_session", "token-forjado")
    assert client.get("/api/auth/me").json()["user"] is None


def test_atualizar_perfil_e_generos(client):
    register(client, "ana")
    r = client.patch(
        "/api/auth/me",
        json={"bio": "Gosto de terror", "favorite_genres": ["terror", "drama", "inexistente"], "show_online": False},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["bio"] == "Gosto de terror"
    assert {g["slug"] for g in body["favorite_genres"]} == {"terror", "drama"}
    assert body["show_online"] is False
