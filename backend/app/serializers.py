"""Montagem das respostas da API. Nunca expõe e-mail/hash de outros usuários."""

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import as_utc
from app.models import Activity, Comment, LibraryEntry, Review, ReviewLike, Title, User, UserList
from app.services.presence import hub


def iso(dt):
    dt = as_utc(dt)
    return dt.isoformat() if dt else None


def user_public(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "name": u.name,
        "bio": u.bio,
        "avatar_hue": u.avatar_hue,
        "plan": u.plan,
        "is_demo": u.is_demo,
        "online": hub.is_visible_online(u.id),
        "joined_at": iso(u.created_at),
    }


def user_private(u: User) -> dict:
    return {
        **user_public(u),
        "email": u.email,
        "show_online": u.show_online,
        "onboarded": u.onboarded,
        "favorite_genres": [{"slug": g.slug, "name": g.name} for g in u.favorite_genres],
    }


def community_stats(db: Session, title_ids: Iterable[int]) -> dict[int, dict]:
    ids = list(set(title_ids))
    if not ids:
        return {}
    rows = db.execute(
        select(Review.title_id, func.count(Review.rating), func.avg(Review.rating))
        .where(Review.title_id.in_(ids), Review.rating.is_not(None))
        .group_by(Review.title_id)
    ).all()
    return {r[0]: {"count": r[1], "avg": round(float(r[2]) / 2, 2) if r[2] else None} for r in rows}


def title_summary(t: Title, stats: dict[int, dict] | None = None, library: dict | None = None) -> dict:
    s = (stats or {}).get(t.id, {"count": 0, "avg": None})
    overview = t.overview or ""
    data = {
        "id": t.id,
        "source": t.source,
        "media_type": t.media_type,
        "title": t.title,
        "year": t.year,
        "poster_url": t.poster_url,
        "backdrop_url": t.backdrop_url,
        "palette": t.palette or [],
        "genres": [{"slug": g.slug, "name": g.name} for g in t.genres],
        "tmdb_rating": t.tmdb_rating,
        "overview": overview if len(overview) <= 280 else overview[:277].rstrip() + "…",
        "community": s,
    }
    if library is not None:
        data["library"] = library
    return data


def titles_summary(db: Session, titles: list[Title], me: User | None = None) -> list[dict]:
    """Resumo em lote. Com `me`, inclui o estado pessoal (quero ver/assistido/favorito)."""
    stats = community_stats(db, (t.id for t in titles))
    libs: dict[int, LibraryEntry] = {}
    if me and titles:
        libs = {
            e.title_id: e
            for e in db.scalars(
                select(LibraryEntry).where(
                    LibraryEntry.user_id == me.id, LibraryEntry.title_id.in_([t.id for t in titles])
                )
            ).unique()
        }
    return [
        title_summary(t, stats, library_state(libs.get(t.id)) if me else None) for t in titles
    ]


def title_detail(db: Session, t: Title, me: User | None) -> dict:
    dist_rows = db.execute(
        select(Review.rating, func.count())
        .where(Review.title_id == t.id, Review.rating.is_not(None))
        .group_by(Review.rating)
    ).all()
    distribution = {str(i): 0 for i in range(1, 11)}
    for rating, n in dist_rows:
        distribution[str(rating)] = n
    total = sum(distribution.values())
    avg = sum(int(k) * v for k, v in distribution.items()) / total / 2 if total else None
    reviews_count = db.scalar(select(func.count()).where(Review.title_id == t.id)) or 0
    watched_count = (
        db.scalar(select(func.count()).where(LibraryEntry.title_id == t.id, LibraryEntry.watched))
        or 0
    )

    mine = None
    if me:
        entry = db.get(LibraryEntry, (me.id, t.id))
        review = db.scalar(select(Review).where(Review.user_id == me.id, Review.title_id == t.id))
        mine = {
            "library": library_state(entry),
            "review": review_out(db, [review], me)[0] if review else None,
        }

    return {
        **title_summary(t, {t.id: {"count": total, "avg": round(avg, 2) if avg else None}}),
        "original_title": t.original_title,
        "overview": t.overview,
        "runtime_min": t.runtime_min,
        "seasons": t.seasons,
        "director": t.director,
        "cast": t.cast or [],
        "themes": t.themes or [],
        "country": t.country,
        "tmdb_votes": t.tmdb_votes,
        "stats": {
            "ratings": total,
            "avg": round(avg, 2) if avg else None,
            "distribution": distribution,
            "reviews": reviews_count,
            "watched": watched_count,
        },
        "mine": mine,
    }


def library_state(entry: LibraryEntry | None) -> dict:
    return {
        "watchlist": bool(entry and entry.watchlist),
        "watched": bool(entry and entry.watched),
        "favorite": bool(entry and entry.favorite),
        "watched_at": iso(entry.watched_at) if entry else None,
    }


def review_out(
    db: Session, reviews: list[Review], me: User | None, with_title: bool = False
) -> list[dict]:
    ids = [r.id for r in reviews]
    likes = dict(
        db.execute(
            select(ReviewLike.review_id, func.count()).where(ReviewLike.review_id.in_(ids)).group_by(ReviewLike.review_id)
        ).all()
    ) if ids else {}
    comments = dict(
        db.execute(
            select(Comment.review_id, func.count()).where(Comment.review_id.in_(ids)).group_by(Comment.review_id)
        ).all()
    ) if ids else {}
    liked = set()
    if me and ids:
        liked = set(
            db.scalars(
                select(ReviewLike.review_id).where(ReviewLike.user_id == me.id, ReviewLike.review_id.in_(ids))
            )
        )
    stats = community_stats(db, (r.title_id for r in reviews)) if with_title else {}
    out = []
    for r in reviews:
        created, updated = as_utc(r.created_at), as_utc(r.updated_at)
        item = {
            "id": r.id,
            "rating": r.rating,
            "body": r.body,
            "spoilers": r.spoilers,
            "created_at": iso(created),
            "updated_at": iso(updated),
            "edited": bool(updated and created and (updated - created).total_seconds() > 2),
            "user": user_public(r.user),
            "title_id": r.title_id,
            "likes": likes.get(r.id, 0),
            "liked": r.id in liked,
            "comments": comments.get(r.id, 0),
            "is_mine": bool(me and me.id == r.user_id),
        }
        if with_title:
            item["title"] = title_summary(r.title, stats)
        out.append(item)
    return out


def comment_out(c: Comment, me: User | None) -> dict:
    return {
        "id": c.id,
        "body": c.body,
        "created_at": iso(c.created_at),
        "user": user_public(c.user),
        "is_mine": bool(me and me.id == c.user_id),
    }


def list_out(db: Session, lst: UserList, me: User | None, full: bool = False) -> dict:
    items = lst.items
    data = {
        "id": lst.id,
        "name": lst.name,
        "description": lst.description,
        "is_public": lst.is_public,
        "created_at": iso(lst.created_at),
        "updated_at": iso(lst.updated_at),
        "user": user_public(lst.user),
        "count": len(items),
        "covers": titles_summary(db, [i.title for i in items[:4]]),
        "is_mine": bool(me and me.id == lst.user_id),
    }
    if full:
        data["items"] = titles_summary(db, [i.title for i in items])
    return data


def activity_out(db: Session, acts: list[Activity], me: User | None) -> list[dict]:
    reviews = [a.review for a in acts if a.review]
    rmap = {r["id"]: r for r in review_out(db, reviews, me)} if reviews else {}
    stats = community_stats(db, (a.title_id for a in acts if a.title_id))
    out = []
    for a in acts:
        out.append(
            {
                "id": a.id,
                "kind": a.kind,
                "created_at": iso(a.created_at),
                "user": user_public(a.user),
                "title": title_summary(a.title, stats) if a.title else None,
                "review": rmap.get(a.review_id) if a.review_id else None,
                "list": {"id": a.list.id, "name": a.list.name} if a.list else None,
                "target_user": user_public(a.target_user) if a.target_user else None,
            }
        )
    return out
