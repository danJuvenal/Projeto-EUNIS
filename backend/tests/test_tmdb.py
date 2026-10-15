"""Cliente TMDb com transporte HTTP simulado (sem rede e sem chave real)."""

import httpx2 as httpx
import pytest
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.services.catalog import CatalogError, CatalogService, ensure_genres

MOVIE = {
    "id": 693134,
    "media_type": "movie",
    "title": "Duna: Parte Dois",
    "original_title": "Dune: Part Two",
    "overview": "Paul Atreides se une a Chani e aos Fremen.",
    "release_date": "2024-02-27",
    "poster_path": "/poster.jpg",
    "backdrop_path": "/backdrop.jpg",
    "vote_average": 8.1,
    "vote_count": 6000,
    "popularity": 300.0,
    "genre_ids": [878, 12],
}


def handler(request: httpx.Request) -> httpx.Response:
    assert request.url.params.get("api_key") == "chave-teste"
    assert request.url.params.get("language") == "pt-BR"
    path = request.url.path
    if path.endswith("/trending/all/week"):
        return httpx.Response(200, json={"results": [MOVIE, {"id": 1, "media_type": "person"}], "total_pages": 1})
    if path.endswith("/movie/693134"):
        return httpx.Response(
            200,
            json={
                **MOVIE,
                "genres": [{"id": 878}, {"id": 12}],
                "runtime": 166,
                "production_countries": [{"iso_3166_1": "US"}],
                "credits": {
                    "crew": [{"job": "Director", "name": "Denis Villeneuve"}],
                    "cast": [{"name": "Timothée Chalamet"}, {"name": "Zendaya"}],
                },
            },
        )
    if path.endswith("/search/multi"):
        return httpx.Response(200, json={"results": [MOVIE], "total_pages": 3})
    return httpx.Response(401, json={})


@pytest.fixture
def svc(engine):
    from app.db import SessionLocal

    db: Session = SessionLocal()
    ensure_genres(db)
    CatalogService._list_cache.clear()
    s = CatalogService(
        db,
        Settings(tmdb_api_key="chave-teste"),
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    yield s
    db.close()


def test_tendencias_gravam_cache_e_ignoram_pessoas(svc):
    items = svc.trending()
    assert [t.title for t in items] == ["Duna: Parte Dois"]
    t = items[0]
    assert t.source == "tmdb" and t.external_key == "tmdb:movie:693134"
    assert t.poster_url == "https://image.tmdb.org/t/p/w500/poster.jpg"
    assert {g.slug for g in t.genres} == {"ficcao-cientifica", "aventura"}
    assert t.year == 2024


def test_detalhes_preenchem_direcao_e_elenco(svc):
    t = svc.trending()[0]
    full = svc.get(t.id)
    assert full.details_loaded and full.runtime_min == 166
    assert full.director == "Denis Villeneuve"
    assert full.cast[:2] == ["Timothée Chalamet", "Zendaya"]


def test_busca_pagina(svc):
    page = svc.search("duna")
    assert page.total_pages == 3 and page.items[0].title == "Duna: Parte Dois"


def test_erro_da_fonte_vira_mensagem_segura(svc):
    with pytest.raises(CatalogError) as exc:
        svc.search("", "tv", None, "popular", 1)  # /discover/tv → 401 no mock
    assert "chave" in str(exc.value).lower()
