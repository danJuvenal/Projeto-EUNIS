"""Regras sociais: registro de atividades, afinidade de gosto, Match e compatibilidade."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models import Activity, Genre, LibraryEntry, Review, Title, User, UserList, utcnow

# ---------------------------------------------------------------- atividades


def record(
    db: Session,
    user: User,
    kind: str,
    *,
    title_id: int | None = None,
    review_id: int | None = None,
    list_id: int | None = None,
    target_user_id: int | None = None,
) -> None:
    """Grava uma atividade real. Evita duplicatas do mesmo evento em sequência."""
    q = select(Activity).where(Activity.user_id == user.id, Activity.kind == kind)
    if kind == "review":
        q = q.where(Activity.review_id == review_id)
    elif kind in ("watched", "watchlist", "favorite"):
        q = q.where(Activity.title_id == title_id, Activity.created_at >= utcnow() - timedelta(days=1))
    elif kind == "list_item":
        q = q.where(Activity.list_id == list_id, Activity.title_id == title_id)
    elif kind == "follow":
        q = q.where(Activity.target_user_id == target_user_id)
    else:
        q = None
    existing = db.scalar(q) if q is not None else None
    if existing:
        existing.created_at = utcnow()
        return
    db.add(
        Activity(
            user_id=user.id,
            kind=kind,
            title_id=title_id,
            review_id=review_id,
            list_id=list_id,
            target_user_id=target_user_id,
        )
    )


def unrecord(db: Session, user: User, kind: str, **where) -> None:
    stmt = delete(Activity).where(Activity.user_id == user.id, Activity.kind == kind)
    for col, val in where.items():
        stmt = stmt.where(getattr(Activity, col) == val)
    db.execute(stmt)


def visible_activities(db: Session, viewer: User | None):
    """Atividades que o visitante pode ver: esconde as ligadas a listas privadas de terceiros."""
    stmt = select(Activity).outerjoin(UserList, Activity.list_id == UserList.id)
    cond = or_(Activity.list_id.is_(None), UserList.is_public.is_(True))
    if viewer:
        cond = or_(cond, UserList.user_id == viewer.id)
    return stmt.where(cond)


# ---------------------------------------------------------------- gosto


def genre_affinity(db: Session, user: User) -> dict[int, float]:
    """Peso por gênero a partir de sinais reais: favoritos, notas e biblioteca."""
    aff: dict[int, float] = defaultdict(float)
    for g in user.favorite_genres:
        aff[g.id] += 3
    for r in db.scalars(select(Review).where(Review.user_id == user.id, Review.rating.is_not(None))):
        w = (r.rating - 5.5) / 4.5 * 2  # 10 → +2 ; 1 → −2
        for g in r.title.genres:
            aff[g.id] += w
    for e in db.scalars(select(LibraryEntry).where(LibraryEntry.user_id == user.id)):
        w = (2 if e.favorite else 0) + (1 if e.watchlist else 0) + (0.5 if e.watched else 0) - (
            0.5 if e.dismissed else 0
        )
        if w:
            for g in e.title.genres:
                aff[g.id] += w
    return dict(aff)


def taste_profile(db: Session, user: User) -> list[dict]:
    """Distribuição de gêneros do que a pessoa assistiu ou avaliou."""
    ids = set(db.scalars(select(Review.title_id).where(Review.user_id == user.id)))
    ids |= set(
        db.scalars(select(LibraryEntry.title_id).where(LibraryEntry.user_id == user.id, LibraryEntry.watched))
    )
    if not ids:
        return []
    c: Counter[str] = Counter()
    names = {}
    for t in db.scalars(select(Title).where(Title.id.in_(ids))):
        for g in t.genres:
            c[g.slug] += 1
            names[g.slug] = g.name
    total = sum(c.values())
    return [
        {"slug": s, "name": names[s], "count": n, "share": round(n / total, 3)}
        for s, n in c.most_common(6)
    ]


def score_candidates(
    db: Session, user: User, candidates: list[Title], limit: int = 20
) -> list[tuple[Title, float, list[str]]]:
    aff = genre_affinity(db, user)
    seen = set(
        db.scalars(
            select(LibraryEntry.title_id).where(
                LibraryEntry.user_id == user.id,
                or_(LibraryEntry.watched, LibraryEntry.watchlist, LibraryEntry.dismissed, LibraryEntry.favorite),
            )
        )
    )
    seen |= set(db.scalars(select(Review.title_id).where(Review.user_id == user.id)))
    loved = list(
        db.scalars(
            select(Review).where(Review.user_id == user.id, Review.rating >= 8).order_by(Review.rating.desc())
        )
    )
    genre_names = {g.id: g.name for g in db.scalars(select(Genre))}
    out = []
    for t in candidates:
        if t.id in seen:
            continue
        gids = [g.id for g in t.genres]
        if not gids:
            continue
        base = sum(aff.get(g, 0) for g in gids) / math.sqrt(len(gids))
        reasons: list[str] = []
        top = sorted((g for g in gids if aff.get(g, 0) > 0), key=lambda g: -aff[g])[:2]
        if top:
            reasons.append("Você curte " + " e ".join(genre_names[g] for g in top))
        for r in loved:
            if r.title_id != t.id and set(gids) & {g.id for g in r.title.genres}:
                reasons.append(f"Porque você deu {r.rating / 2:g}★ para {r.title.title}")
                break
        out.append((t, base + (t.popularity or 0) / 1e4, reasons))
    out.sort(key=lambda x: -x[1])
    return out[:limit]


def _cosine(a: dict[int, float], b: dict[int, float]) -> float | None:
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if not na or not nb:
        return None
    return dot / (na * nb)


MIN_CO_RATED = 3


def compatibility(db: Session, a: User, b: User) -> dict:
    """Compatibilidade real: notas em comum (peso 70%) + perfil de gêneros (30%).

    Com menos de MIN_CO_RATED títulos avaliados por ambos, não há porcentagem —
    a resposta diz quanto falta.
    """
    ra = {r.title_id: r for r in db.scalars(select(Review).where(Review.user_id == a.id, Review.rating.is_not(None)))}
    rb = {r.title_id: r for r in db.scalars(select(Review).where(Review.user_id == b.id, Review.rating.is_not(None)))}
    common = sorted(set(ra) & set(rb), key=lambda t: -(ra[t].rating + rb[t].rating))
    rating_sim = (
        sum(1 - abs(ra[t].rating - rb[t].rating) / 9 for t in common) / len(common) if common else None
    )
    cos = _cosine(genre_affinity(db, a), genre_affinity(db, b))
    genre_sim = (cos + 1) / 2 if cos is not None else None

    enough = len(common) >= MIN_CO_RATED and genre_sim is not None
    score = round(100 * (0.7 * rating_sim + 0.3 * genre_sim)) if enough else None

    aa, ab = genre_affinity(db, a), genre_affinity(db, b)
    shared_genres = sorted(
        (g for g in set(aa) & set(ab) if aa[g] > 0 and ab[g] > 0), key=lambda g: -(aa[g] + ab[g])
    )[:3]
    names = {g.id: g.name for g in db.scalars(select(Genre).where(Genre.id.in_(shared_genres)))} if shared_genres else {}

    return {
        "score": score,
        "enough_data": enough,
        "co_rated": len(common),
        "min_co_rated": MIN_CO_RATED,
        "rating_similarity": round(rating_sim, 3) if rating_sim is not None else None,
        "genre_similarity": round(genre_sim, 3) if genre_sim is not None else None,
        "shared_genres": [names[g] for g in shared_genres if g in names],
        "shared": [
            {"title_id": t, "title": ra[t].title.title, "a": ra[t].rating, "b": rb[t].rating}
            for t in common[:6]
        ],
    }
