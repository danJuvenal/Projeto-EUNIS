"""Catálogo de filmes e séries.

Duas fontes, escolhidas por configuração (D-010):
- TMDb (quando TMDB_API_KEY existe): resultados são gravados na tabela `titles` (cache), e as
  listas (tendências, busca) ficam num cache em memória com TTL para não repetir chamadas.
- Demo (sem chave): os 32 títulos do MVP, buscados localmente. A API informa `source="demo"`
  para a interface sinalizar.
"""

from __future__ import annotations

import logging
import time
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta

import httpx2 as httpx
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Genre, Review, Title, TitleGenre, utcnow
from app.services.demo_catalog import DEMO_TITLES

log = logging.getLogger("eunis.catalog")

PAGE_SIZE = 20
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p"

# slug, nome, id de gênero TMDb (filme), id de gênero TMDb (série)
GENRES: list[tuple[str, str, int | None, int | None]] = [
    ("acao", "Ação", 28, 10759),
    ("aventura", "Aventura", 12, 10759),
    ("animacao", "Animação", 16, 16),
    ("comedia", "Comédia", 35, 35),
    ("crime", "Crime", 80, 80),
    ("documentario", "Documentário", 99, 99),
    ("drama", "Drama", 18, 18),
    ("familia", "Família", 10751, 10751),
    ("fantasia", "Fantasia", 14, 10765),
    ("ficcao-cientifica", "Ficção científica", 878, 10765),
    ("historia", "História", 36, None),
    ("misterio", "Mistério", 9648, 9648),
    ("musica", "Música", 10402, None),
    ("romance", "Romance", 10749, None),
    ("suspense", "Suspense", 53, None),
    ("terror", "Terror", 27, None),
    ("guerra", "Guerra", 10752, 10768),
    ("faroeste", "Faroeste", 37, 37),
]

SORTS = {"popular", "rating", "recent", "title"}


class CatalogError(Exception):
    """Falha ao consultar a fonte externa. A mensagem é segura para o usuário."""


def normalize(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
    )


@dataclass
class Page:
    items: list[Title]
    page: int
    total_pages: int


# ---------------------------------------------------------------- seed


def ensure_genres(db: Session) -> None:
    existing = {g.slug for g in db.scalars(select(Genre))}
    for slug, name, mid, tid in GENRES:
        if slug not in existing:
            db.add(Genre(slug=slug, name=name, tmdb_movie_id=mid, tmdb_tv_id=tid))
    db.commit()


def ensure_demo_catalog(db: Session) -> None:
    """Idempotente: insere os títulos demo que faltarem (chave `demo:<id>`)."""
    ensure_genres(db)
    by_slug = {g.slug: g for g in db.scalars(select(Genre))}
    existing = set(db.scalars(select(Title.external_key).where(Title.source == "demo")))
    for t in DEMO_TITLES:
        key = f"demo:{t['key']}"
        if key in existing:
            continue
        db.add(
            Title(
                external_key=key,
                source="demo",
                media_type=t["media_type"],
                title=t["title"],
                overview=t["overview"],
                year=t["year"],
                runtime_min=t["runtime_min"],
                seasons=t["seasons"],
                director=t["director"],
                themes=t["themes"],
                country=t["country"],
                palette=t["palette"],
                genres=[by_slug[s] for s in t["genres"]],
                details_loaded=True,
            )
        )
    db.commit()


# ---------------------------------------------------------------- serviço


class CatalogService:
    def __init__(self, db: Session, settings: Settings, http: httpx.Client | None = None):
        self.db = db
        self.settings = settings
        self.source = settings.catalog_source
        self._http = http

    # ---------- API pública

    def trending(self, media_type: str | None = None, limit: int = 20) -> list[Title]:
        if self.source == "tmdb":
            path = f"/trending/{media_type or 'all'}/week"
            return self._tmdb_list(path, {}, media_type)[0][:limit]
        return self._demo_query(media_type=media_type, sort="popular")[:limit]

    def search(
        self,
        query: str = "",
        media_type: str | None = None,
        genre: str | None = None,
        sort: str = "popular",
        page: int = 1,
    ) -> Page:
        sort = sort if sort in SORTS else "popular"
        if self.source == "tmdb":
            return self._tmdb_search(query.strip(), media_type, genre, sort, page)
        items = self._demo_query(query, media_type, genre, sort)
        total = max(1, -(-len(items) // PAGE_SIZE))
        start = (page - 1) * PAGE_SIZE
        return Page(items[start : start + PAGE_SIZE], page, total)

    def get(self, title_id: int) -> Title | None:
        title = self.db.get(Title, title_id)
        if title and title.source == "tmdb" and not title.details_loaded and self.source == "tmdb":
            try:
                self._tmdb_details(title)
            except CatalogError:
                log.warning("detalhes TMDb indisponíveis para %s", title.external_key)
        return title

    def related(self, title: Title, limit: int = 12) -> list[Title]:
        if title.source == "tmdb" and self.source == "tmdb":
            _, mt, tid = title.external_key.split(":")
            try:
                return self._tmdb_list(f"/{mt}/{tid}/recommendations", {}, mt)[0][:limit]
            except CatalogError:
                return []
        return self._local_related(title, limit)

    # ---------- modo demo

    def _demo_query(
        self,
        query: str = "",
        media_type: str | None = None,
        genre: str | None = None,
        sort: str = "popular",
    ) -> list[Title]:
        stmt = select(Title).where(Title.source == "demo")
        if media_type in ("movie", "tv"):
            stmt = stmt.where(Title.media_type == media_type)
        if genre:
            stmt = stmt.join(TitleGenre).join(Genre).where(Genre.slug == genre)
        titles = list(self.db.scalars(stmt).unique())

        if query:
            terms = [w for w in normalize(query).split() if len(w) > 1]
            scored = []
            for t in titles:
                hay_title = normalize(t.title)
                hay = " ".join(
                    [
                        hay_title,
                        normalize(t.overview),
                        normalize(t.director or ""),
                        " ".join(normalize(x) for x in t.themes),
                        " ".join(normalize(g.name) for g in t.genres),
                    ]
                )
                score = 0.0
                if normalize(query) in hay_title:
                    score += 10
                for w in terms:
                    if w in hay_title:
                        score += 3
                    elif w in hay:
                        score += 1
                if score:
                    scored.append((score, t))
            scored.sort(key=lambda x: (-x[0], x[1].title))
            return [t for _, t in scored]

        return self._sort_local(titles, sort)

    def _community_stats(self, ids: list[int]) -> dict[int, tuple[int, float | None, int]]:
        """title_id → (nº de críticas, média 1..10, críticas nos últimos 30 dias)."""
        if not ids:
            return {}
        since = utcnow() - timedelta(days=30)
        rows = self.db.execute(
            select(
                Review.title_id,
                func.count(Review.id),
                func.avg(Review.rating),
                func.sum(case((Review.created_at >= since, 1), else_=0)),
            )
            .where(Review.title_id.in_(ids))
            .group_by(Review.title_id)
        ).all()
        return {r[0]: (r[1], float(r[2]) if r[2] is not None else None, int(r[3] or 0)) for r in rows}

    def _sort_local(self, titles: list[Title], sort: str) -> list[Title]:
        stats = self._community_stats([t.id for t in titles])
        if sort == "title":
            return sorted(titles, key=lambda t: normalize(t.title))
        if sort == "recent":
            return sorted(titles, key=lambda t: (-(t.year or 0), t.title))
        if sort == "rating":
            return sorted(
                titles,
                key=lambda t: (-(stats.get(t.id, (0, 0, 0))[1] or 0), -(t.year or 0)),
            )
        # popular = atividade real da comunidade; empate → mais recente
        return sorted(
            titles,
            key=lambda t: (
                -stats.get(t.id, (0, 0, 0))[2],
                -stats.get(t.id, (0, 0, 0))[0],
                -(t.year or 0),
                t.title,
            ),
        )

    def _local_related(self, title: Title, limit: int) -> list[Title]:
        stmt = select(Title).where(Title.source == title.source, Title.id != title.id)
        g = {x.id for x in title.genres}
        th = set(title.themes)
        scored = []
        for t in self.db.scalars(stmt).unique():
            s = 2 * len(g & {x.id for x in t.genres}) + len(th & set(t.themes))
            if t.director and t.director == title.director:
                s += 2
            if s:
                scored.append((s, t))
        scored.sort(key=lambda x: (-x[0], x[1].title))
        return [t for _, t in scored[:limit]]

    # ---------- TMDb

    _list_cache: dict[str, tuple[float, list[int], int]] = {}
    LIST_TTL = 60 * 30

    def _client(self) -> httpx.Client:
        if self._http is None:
            self._http = httpx.Client(timeout=8.0)
        return self._http

    def _tmdb_get(self, path: str, params: dict) -> dict:
        key = self.settings.tmdb_api_key
        headers = {"accept": "application/json"}
        params = {"language": self.settings.tmdb_language, **params}
        if key.startswith("eyJ"):  # token de leitura v4
            headers["Authorization"] = f"Bearer {key}"
        else:
            params["api_key"] = key
        try:
            resp = self._client().get(TMDB_BASE + path, params=params, headers=headers)
        except httpx.HTTPError as exc:
            log.error("TMDb indisponível: %s", exc)
            raise CatalogError("O catálogo está indisponível no momento.") from exc
        if resp.status_code == 401:
            log.error("TMDb recusou a chave (401)")
            raise CatalogError("Catálogo mal configurado (chave TMDb inválida).")
        if resp.status_code == 404:
            raise CatalogError("Título não encontrado no catálogo.")
        if resp.status_code >= 400:
            log.error("TMDb %s em %s", resp.status_code, path)
            raise CatalogError("O catálogo está indisponível no momento.")
        return resp.json()

    def _genre_maps(self) -> tuple[dict[int, list[Genre]], dict[int, list[Genre]], dict[str, Genre]]:
        ensure_genres(self.db)
        movie: dict[int, list[Genre]] = {}
        tv: dict[int, list[Genre]] = {}
        by_slug = {}
        for g in self.db.scalars(select(Genre)):
            by_slug[g.slug] = g
            if g.tmdb_movie_id:
                movie.setdefault(g.tmdb_movie_id, []).append(g)
            if g.tmdb_tv_id:
                tv.setdefault(g.tmdb_tv_id, []).append(g)
        return movie, tv, by_slug

    def _upsert(self, item: dict, media_type: str, maps=None) -> Title | None:
        mt = item.get("media_type") or media_type
        if mt not in ("movie", "tv"):
            return None
        movie_map, tv_map, _ = maps or self._genre_maps()
        gmap = movie_map if mt == "movie" else tv_map
        key = f"tmdb:{mt}:{item['id']}"
        title = self.db.scalar(select(Title).where(Title.external_key == key))
        if title is None:
            title = Title(external_key=key, source="tmdb", media_type=mt)
            self.db.add(title)
        date_str = item.get("release_date") or item.get("first_air_date") or ""
        title.title = item.get("title") or item.get("name") or "Sem título"
        title.original_title = item.get("original_title") or item.get("original_name")
        title.overview = item.get("overview") or title.overview or ""
        title.year = int(date_str[:4]) if date_str[:4].isdigit() else title.year
        if item.get("poster_path"):
            title.poster_url = f"{TMDB_IMG}/w500{item['poster_path']}"
        if item.get("backdrop_path"):
            title.backdrop_url = f"{TMDB_IMG}/w1280{item['backdrop_path']}"
        title.tmdb_rating = item.get("vote_average")
        title.tmdb_votes = item.get("vote_count")
        title.popularity = item.get("popularity") or 0
        gids = item.get("genre_ids") or [g["id"] for g in item.get("genres", [])]
        seen: dict[int, Genre] = {}
        for gid in gids:
            for g in gmap.get(gid, []):
                seen[g.id] = g
        if seen:
            title.genres = list(seen.values())
        return title

    def _tmdb_list(self, path: str, params: dict, media_type: str | None) -> tuple[list[Title], int]:
        cache_key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        hit = self._list_cache.get(cache_key)
        if hit and hit[0] > time.monotonic():
            ids, total = hit[1], hit[2]
            by_id = {t.id: t for t in self.db.scalars(select(Title).where(Title.id.in_(ids)))}
            return [by_id[i] for i in ids if i in by_id], total

        data = self._tmdb_get(path, params)
        maps = self._genre_maps()
        titles = [t for item in data.get("results", []) if (t := self._upsert(item, media_type or "", maps))]
        self.db.commit()
        total = min(int(data.get("total_pages") or 1), 500)
        self._list_cache[cache_key] = (time.monotonic() + self.LIST_TTL, [t.id for t in titles], total)
        return titles, total

    def _tmdb_search(
        self, query: str, media_type: str | None, genre: str | None, sort: str, page: int
    ) -> Page:
        if query:
            path = f"/search/{media_type}" if media_type in ("movie", "tv") else "/search/multi"
            items, total = self._tmdb_list(path, {"query": query, "page": page}, media_type)
            if genre:
                items = [t for t in items if any(g.slug == genre for g in t.genres)]
            return Page(items, page, total)

        mt = media_type if media_type in ("movie", "tv") else "movie"
        _, _, by_slug = self._genre_maps()
        params: dict = {"page": page, "include_adult": "false"}
        if genre and genre in by_slug:
            gid = by_slug[genre].tmdb_movie_id if mt == "movie" else by_slug[genre].tmdb_tv_id
            if gid is None:
                return Page([], page, 1)
            params["with_genres"] = gid
        date_field = "primary_release_date" if mt == "movie" else "first_air_date"
        if sort == "rating":
            params.update({"sort_by": "vote_average.desc", "vote_count.gte": 300})
        elif sort == "recent":
            params.update(
                {"sort_by": f"{date_field}.desc", f"{date_field}.lte": date.today().isoformat(),
                 "vote_count.gte": 20}
            )
        elif sort == "title":
            params["sort_by"] = "title.asc" if mt == "movie" else "name.asc"
        else:
            params["sort_by"] = "popularity.desc"
        items, total = self._tmdb_list(f"/discover/{mt}", params, mt)
        return Page(items, page, total)

    def _tmdb_details(self, title: Title) -> None:
        _, mt, tid = title.external_key.split(":")
        data = self._tmdb_get(f"/{mt}/{tid}", {"append_to_response": "credits"})
        self._upsert({**data, "media_type": mt}, mt)
        credits = data.get("credits") or {}
        if mt == "movie":
            title.runtime_min = data.get("runtime") or None
            directors = [c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"]
            countries = data.get("production_countries") or []
            title.country = countries[0]["iso_3166_1"] if countries else None
        else:
            rt = data.get("episode_run_time") or []
            title.runtime_min = rt[0] if rt else None
            title.seasons = data.get("number_of_seasons")
            directors = [c["name"] for c in data.get("created_by", [])]
            oc = data.get("origin_country") or []
            title.country = oc[0] if oc else None
        title.director = ", ".join(directors[:2]) or None
        title.cast = [c["name"] for c in credits.get("cast", [])[:10]]
        title.details_loaded = True
        self.db.commit()
