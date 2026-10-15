from tests.conftest import register


def _tid(c, q):
    return c.get("/api/titles", params={"q": q}).json()["results"][0]["id"]


def test_catalogo_demo_busca_e_filtros(client):
    assert client.get("/api/catalog/status").json() == {"source": "demo"}
    r = client.get("/api/titles", params={"q": "zumbi"}).json()
    assert {t["title"] for t in r["results"]} >= {"Invasão Zumbi", "The Last of Us"}
    series = client.get("/api/titles", params={"type": "tv"}).json()["results"]
    assert series and all(t["media_type"] == "tv" for t in series)
    terror = client.get("/api/titles", params={"genre": "terror"}).json()["results"]
    assert terror and all(any(g["slug"] == "terror" for g in t["genres"]) for t in terror)
    assert client.get("/api/titles/99999").status_code == 404


def test_detalhe_sem_nota_inventada(client):
    tid = _tid(client, "Parasita")
    d = client.get(f"/api/titles/{tid}").json()
    assert d["stats"]["ratings"] == 0 and d["stats"]["avg"] is None
    assert d["tmdb_rating"] is None  # notaBase do MVP não é exposta
    assert d["director"] == "Bong Joon-ho"


def test_critica_crud_e_media(make_client):
    a, b = make_client(), make_client()
    register(a, "ana")
    register(b, "bia")
    tid = _tid(a, "Duna")

    r = a.put(f"/api/titles/{tid}/review", json={"rating": 10, "body": "Areia!"})
    assert r.status_code == 200
    rid = r.json()["id"]
    b.put(f"/api/titles/{tid}/review", json={"rating": 6})
    d = a.get(f"/api/titles/{tid}").json()
    assert d["stats"]["ratings"] == 2 and d["stats"]["avg"] == 4.0
    assert d["mine"]["library"]["watched"] is True

    # editar: continua uma por usuário
    a.put(f"/api/titles/{tid}/review", json={"rating": 8, "body": "Revi."})
    assert a.get(f"/api/titles/{tid}").json()["stats"]["ratings"] == 2

    # validações
    assert a.put(f"/api/titles/{tid}/review", json={"rating": 11}).status_code == 422
    assert a.put(f"/api/titles/{tid}/review", json={"body": "  "}).status_code == 422

    # autorização: B não exclui crítica de A
    assert b.delete(f"/api/reviews/{rid}").status_code == 403
    assert a.delete(f"/api/reviews/{rid}").status_code == 204
    assert a.get(f"/api/titles/{tid}").json()["stats"]["ratings"] == 1


def test_curtidas_e_comentarios(make_client):
    a, b = make_client(), make_client()
    register(a, "ana")
    register(b, "bia")
    tid = _tid(a, "Dark")
    rid = a.put(f"/api/titles/{tid}/review", json={"rating": 9, "body": "Labirinto."}).json()["id"]

    r = b.put(f"/api/reviews/{rid}/like").json()
    assert r["likes"] == 1 and r["liked"] is True
    assert b.put(f"/api/reviews/{rid}/like").json()["likes"] == 1  # idempotente
    assert b.delete(f"/api/reviews/{rid}/like").json()["likes"] == 0

    cid = b.post(f"/api/reviews/{rid}/comments", json={"body": "Concordo"}).json()["id"]
    assert b.post(f"/api/reviews/{rid}/comments", json={"body": "   "}).status_code == 422
    assert a.delete(f"/api/comments/{cid}").status_code == 403
    assert b.delete(f"/api/comments/{cid}").status_code == 204


def test_listas_privadas_e_autorizacao(make_client):
    a, b = make_client(), make_client()
    register(a, "ana")
    register(b, "bia")
    tid = _tid(a, "Arcane")
    lst = a.post("/api/lists", json={"name": "Segredo", "is_public": False}).json()
    a.post(f"/api/lists/{lst['id']}/items", json={"title_id": tid})

    assert a.get(f"/api/lists/{lst['id']}").json()["count"] == 1
    assert b.get(f"/api/lists/{lst['id']}").status_code == 404  # não revela que existe
    assert b.patch(f"/api/lists/{lst['id']}", json={"name": "x"}).status_code == 404
    assert b.get("/api/users/ana/lists").json()["results"] == []
    # atividade de lista privada não aparece para terceiros
    kinds = [x["kind"] for x in b.get("/api/community/activity").json()["results"]]
    assert "list_item" not in kinds and "list_created" not in kinds

    a.patch(f"/api/lists/{lst['id']}", json={"is_public": True})
    assert b.get(f"/api/lists/{lst['id']}").status_code == 200
    assert b.patch(f"/api/lists/{lst['id']}", json={"name": "x"}).status_code == 403
    assert b.delete(f"/api/lists/{lst['id']}").status_code == 403
    assert a.delete(f"/api/lists/{lst['id']}/items/{tid}").json()["count"] == 0


def test_biblioteca_seguir_e_feed(make_client):
    a, b = make_client(), make_client()
    register(a, "ana")
    register(b, "bia")
    tid = _tid(a, "Ruptura")

    assert b.put(f"/api/titles/{tid}/library", json={"watchlist": True}).json()["watchlist"] is True
    assert a.put("/api/users/bia/follow").json() == {"following": True}
    assert a.put("/api/users/ana/follow").status_code == 400

    feed = a.get("/api/feed").json()
    assert feed["following"] == 1
    assert any(x["kind"] == "watchlist" and x["user"]["username"] == "bia" for x in feed["results"])

    # desfazer remove a atividade (feed honesto)
    b.put(f"/api/titles/{tid}/library", json={"watchlist": False})
    assert not any(x["kind"] == "watchlist" for x in a.get("/api/feed").json()["results"])

    prof = b.get("/api/users/bia").json()
    assert prof["stats"]["followers"] == 1
    assert "email" not in prof


def test_compatibilidade_exige_dados_suficientes(make_client):
    a, b = make_client(), make_client()
    register(a, "ana")
    register(b, "bia")
    ids = [_tid(a, q) for q in ("Duna", "Dark", "Arcane")]

    a.put(f"/api/titles/{ids[0]}/review", json={"rating": 10})
    b.put(f"/api/titles/{ids[0]}/review", json={"rating": 10})
    r = a.get("/api/users/bia/compat").json()
    assert r["score"] is None and r["enough_data"] is False and r["co_rated"] == 1

    for tid, (x, y) in zip(ids[1:], [(8, 8), (2, 10)], strict=True):
        a.put(f"/api/titles/{tid}/review", json={"rating": x})
        b.put(f"/api/titles/{tid}/review", json={"rating": y})
    r = a.get("/api/users/bia/compat").json()
    assert r["enough_data"] is True and r["co_rated"] == 3
    assert 0 <= r["score"] <= 100
    # notas iguais em 2 de 3 e uma divergência grande → similaridade de notas < 1
    assert r["rating_similarity"] < 1


def test_match_exclui_o_que_ja_foi_visto(client):
    register(client, "ana")
    client.patch("/api/auth/me", json={"favorite_genres": ["terror"]})
    deck = client.get("/api/match").json()["results"]
    assert deck and any(g["slug"] == "terror" for g in deck[0]["genres"])
    first = deck[0]["id"]
    client.put(f"/api/titles/{first}/library", json={"dismissed": True})
    assert first not in [t["id"] for t in client.get("/api/match").json()["results"]]
