"""Catálogo, detalhes, críticas por título e biblioteca pessoal (quero ver / assistido / favorito)."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import DB, Catalog, CurrentUser, OptionalUser, SettingsDep, require_feature
from app.models import Genre, LibraryEntry, Review, Title, utcnow
from app.schemas import LibraryIn, ReviewIn
from app.serializers import library_state, review_out, title_detail, titles_summary
from app.services import social
from app.services.catalog import CatalogError

router = APIRouter(prefix="/api", tags=["catálogo"])

MediaType = Literal["movie", "tv"] | None


def _catalog_error(exc: CatalogError) -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))


@router.get("/catalog/status")
def catalog_status(settings: SettingsDep):
    return {"source": settings.catalog_source}


@router.get("/genres")
def genres(db: DB):
    return [{"slug": g.slug, "name": g.name} for g in db.scalars(select(Genre).order_by(Genre.name))]


@router.get("/titles")
def search_titles(
    cat: Catalog,
    db: DB,
    me: OptionalUser,
    q: str = Query("", max_length=100),
    type: MediaType = None,
    genre: str | None = Query(None, max_length=40),
    sort: str = "popular",
    page: int = Query(1, ge=1, le=500),
):
    try:
        res = cat.search(q, type, genre, sort, page)
    except CatalogError as exc:
        raise _catalog_error(exc) from exc
    return {
        "source": cat.source,
        "page": res.page,
        "total_pages": res.total_pages,
        "results": titles_summary(db, res.items, me),
    }


@router.get("/titles/trending")
def trending(
    cat: Catalog, db: DB, me: OptionalUser, type: MediaType = None, limit: int = Query(20, ge=1, le=40)
):
    try:
        items = cat.trending(type, limit)
    except CatalogError as exc:
        raise _catalog_error(exc) from exc
    return {"source": cat.source, "results": titles_summary(db, items, me)}


def _get_title(cat, title_id: int) -> Title:
    title = cat.get(title_id)
    if not title:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Título não encontrado.")
    return title


@router.get("/titles/{title_id}")
def title(title_id: int, cat: Catalog, db: DB, me: OptionalUser):
    return title_detail(db, _get_title(cat, title_id), me)


@router.get("/titles/{title_id}/related")
def related(title_id: int, cat: Catalog, db: DB, me: OptionalUser):
    return {"results": titles_summary(db, cat.related(_get_title(cat, title_id)), me)}


@router.get("/titles/{title_id}/reviews")
def title_reviews(
    title_id: int,
    db: DB,
    me: OptionalUser,
    sort: Literal["recent", "popular"] = "recent",
    limit: int = Query(30, ge=1, le=100),
):
    stmt = select(Review).where(Review.title_id == title_id)
    if sort == "popular":
        from app.models import ReviewLike

        likes = (
            select(ReviewLike.review_id, func.count().label("n")).group_by(ReviewLike.review_id).subquery()
        )
        stmt = stmt.outerjoin(likes, likes.c.review_id == Review.id).order_by(
            func.coalesce(likes.c.n, 0).desc(), Review.created_at.desc()
        )
    else:
        stmt = stmt.order_by(Review.created_at.desc())
    reviews = list(db.scalars(stmt.limit(limit)).unique())
    return {"results": review_out(db, reviews, me)}


@router.put("/titles/{title_id}/review")
def upsert_review(title_id: int, data: ReviewIn, cat: Catalog, db: DB, me: CurrentUser):
    """Cria ou edita a crítica do usuário logado. Só o próprio autor chega aqui."""
    require_feature(me, "review")
    _get_title(cat, title_id)
    if data.rating is None and not data.body:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Dê uma nota ou escreva algo.")
    review = db.scalar(select(Review).where(Review.user_id == me.id, Review.title_id == title_id))
    if review is None:
        review = Review(user_id=me.id, title_id=title_id)
        db.add(review)
    review.rating, review.body, review.spoilers = data.rating, data.body, data.spoilers
    review.updated_at = utcnow()
    # Avaliar implica ter assistido
    entry = db.get(LibraryEntry, (me.id, title_id)) or LibraryEntry(user_id=me.id, title_id=title_id)
    if not entry.watched:
        entry.watched, entry.watched_at, entry.watchlist = True, utcnow(), False
    db.add(entry)
    db.flush()
    social.record(db, me, "review", title_id=title_id, review_id=review.id)
    db.commit()
    db.refresh(review)
    return review_out(db, [review], me)[0]


@router.put("/titles/{title_id}/library")
def update_library(title_id: int, data: LibraryIn, cat: Catalog, db: DB, me: CurrentUser):
    _get_title(cat, title_id)
    entry = db.get(LibraryEntry, (me.id, title_id))
    if entry is None:
        entry = LibraryEntry(user_id=me.id, title_id=title_id)
        db.add(entry)
    for field in ("watchlist", "watched", "favorite", "dismissed"):
        val = getattr(data, field)
        if val is None:
            continue
        before = bool(getattr(entry, field))
        setattr(entry, field, val)
        if field == "watched":
            entry.watched_at = utcnow() if val else None
            if val:
                entry.watchlist = False
        if field in ("watchlist", "watched", "favorite") and val != before:
            if val:
                social.record(db, me, field, title_id=title_id)
            else:
                social.unrecord(db, me, field, title_id=title_id)
    db.commit()
    return library_state(entry)
