"""Perfis públicos, seguir, biblioteca pública, perfil de gosto e compatibilidade."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import DB, CurrentUser, OptionalUser
from app.models import Follow, LibraryEntry, Review, User, UserList
from app.serializers import list_out, review_out, titles_summary, user_public
from app.services import social

router = APIRouter(prefix="/api/users", tags=["perfis"])


def _user(db, username: str) -> User:
    u = db.scalar(select(User).where(User.username == username.lower()))
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Perfil não encontrado.")
    return u


@router.get("")
def members(db: DB, q: str = Query("", max_length=40), limit: int = Query(24, ge=1, le=60)):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(User.username).like(like) | func.lower(User.name).like(like))
    return {"results": [user_public(u) for u in db.scalars(stmt.limit(limit))]}


@router.get("/{username}")
def profile(username: str, db: DB, me: OptionalUser):
    u = _user(db, username)
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731
    favorites = list(
        db.scalars(
            select(LibraryEntry)
            .where(LibraryEntry.user_id == u.id, LibraryEntry.favorite)
            .order_by(LibraryEntry.updated_at.desc())
            .limit(8)
        ).unique()
    )
    fav_titles = [e.title for e in favorites]
    return {
        **user_public(u),
        "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at and u.show_online else None,
        "stats": {
            "watched": count(select(func.count()).where(LibraryEntry.user_id == u.id, LibraryEntry.watched)),
            "reviews": count(select(func.count()).where(Review.user_id == u.id)),
            "lists": count(select(func.count()).where(UserList.user_id == u.id, UserList.is_public)),
            "followers": count(select(func.count()).where(Follow.followee_id == u.id)),
            "following": count(select(func.count()).where(Follow.follower_id == u.id)),
        },
        "favorites": {
            "movies": titles_summary(db, [t for t in fav_titles if t.media_type == "movie"]),
            "series": titles_summary(db, [t for t in fav_titles if t.media_type == "tv"]),
        },
        "taste": social.taste_profile(db, u),
        "is_me": bool(me and me.id == u.id),
        "followed_by_me": bool(me and db.get(Follow, (me.id, u.id))),
        "follows_me": bool(me and db.get(Follow, (u.id, me.id))),
    }


@router.get("/{username}/library")
def library(
    username: str,
    db: DB,
    me: OptionalUser,
    shelf: Literal["watched", "watchlist", "favorite"] = "watched",
    limit: int = Query(60, ge=1, le=200),
):
    u = _user(db, username)
    col = getattr(LibraryEntry, shelf)
    order = LibraryEntry.watched_at.desc() if shelf == "watched" else LibraryEntry.updated_at.desc()
    entries = db.scalars(
        select(LibraryEntry).where(LibraryEntry.user_id == u.id, col).order_by(order).limit(limit)
    ).unique()
    return {"results": titles_summary(db, [e.title for e in entries], me)}


@router.get("/{username}/reviews")
def user_reviews(username: str, db: DB, me: OptionalUser, limit: int = Query(30, ge=1, le=100)):
    u = _user(db, username)
    reviews = db.scalars(
        select(Review).where(Review.user_id == u.id).order_by(Review.created_at.desc()).limit(limit)
    ).unique()
    return {"results": review_out(db, list(reviews), me, with_title=True)}


@router.get("/{username}/lists")
def user_lists(username: str, db: DB, me: OptionalUser):
    u = _user(db, username)
    stmt = select(UserList).where(UserList.user_id == u.id).order_by(UserList.updated_at.desc())
    if not me or me.id != u.id:
        stmt = stmt.where(UserList.is_public)
    return {"results": [list_out(db, lst, me) for lst in db.scalars(stmt).unique()]}


@router.get("/{username}/followers")
def followers(username: str, db: DB):
    u = _user(db, username)
    rows = db.scalars(
        select(User).join(Follow, Follow.follower_id == User.id).where(Follow.followee_id == u.id)
    )
    return {"results": [user_public(x) for x in rows]}


@router.get("/{username}/following")
def following(username: str, db: DB):
    u = _user(db, username)
    rows = db.scalars(
        select(User).join(Follow, Follow.followee_id == User.id).where(Follow.follower_id == u.id)
    )
    return {"results": [user_public(x) for x in rows]}


@router.put("/{username}/follow")
def follow(username: str, db: DB, me: CurrentUser):
    u = _user(db, username)
    if u.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Você não pode seguir a si mesmo.")
    if not db.get(Follow, (me.id, u.id)):
        db.add(Follow(follower_id=me.id, followee_id=u.id))
        social.record(db, me, "follow", target_user_id=u.id)
        db.commit()
    return {"following": True}


@router.delete("/{username}/follow")
def unfollow(username: str, db: DB, me: CurrentUser):
    u = _user(db, username)
    f = db.get(Follow, (me.id, u.id))
    if f:
        db.delete(f)
        social.unrecord(db, me, "follow", target_user_id=u.id)
        db.commit()
    return {"following": False}


@router.get("/{username}/compat")
def compat(username: str, db: DB, me: CurrentUser):
    u = _user(db, username)
    if u.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Compare com outra pessoa.")
    return social.compatibility(db, me, u)
