"""Feed, atividade da comunidade, números reais, Match e presença (REST + WebSocket)."""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db import SessionLocal
from app.deps import DB, Catalog, CurrentUser, OptionalUser, user_from_token
from app.models import Activity, Follow, Genre, Review, Title, User, utcnow
from app.serializers import activity_out, titles_summary
from app.services import social
from app.services.catalog import CatalogError
from app.services.presence import hub

log = logging.getLogger("eunis.community")
router = APIRouter(prefix="/api", tags=["comunidade"])


@router.get("/feed")
def feed(db: DB, me: CurrentUser, limit: int = Query(30, ge=1, le=60), before: int | None = None):
    """Atividade de quem você segue + a sua."""
    ids = list(db.scalars(select(Follow.followee_id).where(Follow.follower_id == me.id))) + [me.id]
    stmt = social.visible_activities(db, me).where(Activity.user_id.in_(ids))
    if before:
        stmt = stmt.where(Activity.id < before)
    acts = list(db.scalars(stmt.order_by(Activity.id.desc()).limit(limit)).unique())
    return {"results": activity_out(db, acts, me), "following": len(ids) - 1}


@router.get("/community/activity")
def community_activity(
    db: DB, me: OptionalUser, limit: int = Query(20, ge=1, le=60), before: int | None = None
):
    stmt = social.visible_activities(db, me).where(Activity.kind != "follow")
    if before:
        stmt = stmt.where(Activity.id < before)
    acts = list(db.scalars(stmt.order_by(Activity.id.desc()).limit(limit)).unique())
    return {"results": activity_out(db, acts, me)}


@router.get("/community/stats")
def community_stats(db: DB):
    """Números reais do banco. `demo_members` permite à interface ser transparente."""
    return {
        "members": db.scalar(select(func.count()).select_from(User)) or 0,
        "demo_members": db.scalar(select(func.count()).where(User.is_demo)) or 0,
        "reviews": db.scalar(select(func.count()).select_from(Review)) or 0,
        "online": len(hub.snapshot()),
    }


@router.get("/match")
def match_deck(cat: Catalog, db: DB, me: CurrentUser, limit: int = Query(15, ge=1, le=30)):
    """Baralho do Match: candidatos ordenados pela afinidade real de gêneros."""
    pool: dict[int, Title] = {}
    try:
        if cat.source == "tmdb":
            for t in cat.trending(None, 40):
                pool[t.id] = t
            top = sorted(social.genre_affinity(db, me).items(), key=lambda x: -x[1])[:3]
            slugs = {g.id: g.slug for g in db.scalars(select(Genre))}
            for gid, w in top:
                if w > 0:
                    for mt in ("movie", "tv"):
                        for t in cat.search("", mt, slugs[gid], "popular", 1).items:
                            pool[t.id] = t
        else:
            for t in db.scalars(select(Title).where(Title.source == "demo")).unique():
                pool[t.id] = t
    except CatalogError:
        log.warning("Match sem catálogo externo")
    scored = social.score_candidates(db, me, list(pool.values()), limit)
    summaries = titles_summary(db, [t for t, _, _ in scored], me)
    for s, (t, _, reasons) in zip(summaries, scored, strict=True):
        s["overview"] = t.overview
        s["reasons"] = reasons
    return {
        "results": summaries,
        "has_signals": bool(me.favorite_genres) or bool(social.genre_affinity(db, me)),
    }


@router.get("/presence/online")
def online():
    return hub.message()


# ---------------------------------------------------------------- WebSocket

ACTIVITY_LABELS = {
    "home": "Na página inicial",
    "feed": "Lendo o feed",
    "community": "Na comunidade",
    "match": "Jogando o Match",
    "profile": "Visitando perfis",
    "lists": "Organizando listas",
    "settings": "Ajustando o perfil",
}


def _activity_from(raw) -> dict:
    """Converte o que o cliente reporta em atividade validada. Texto vem só do servidor."""
    if not isinstance(raw, dict):
        return {"kind": "browsing", "label": "Navegando"}
    kind = raw.get("kind")
    if kind in ACTIVITY_LABELS:
        return {"kind": kind, "label": ACTIVITY_LABELS[kind]}
    if kind == "explore":
        genre = raw.get("genre")
        if isinstance(genre, str) and len(genre) <= 40:
            with SessionLocal() as db:
                g = db.scalar(select(Genre).where(Genre.slug == genre))
            if g:
                return {"kind": "explore", "label": f"Explorando {g.name.lower()}"}
        return {"kind": "explore", "label": "Explorando o catálogo"}
    if kind in ("title", "review") and isinstance(raw.get("title_id"), int):
        with SessionLocal() as db:
            t = db.get(Title, raw["title_id"])
        if t:
            label = f"Escrevendo sobre {t.title}" if kind == "review" else f"Vendo {t.title}"
            return {"kind": kind, "label": label, "title_id": t.id}
    return {"kind": "browsing", "label": "Navegando"}


def _touch_last_seen(user_id: int) -> None:
    with SessionLocal() as db:
        u = db.get(User, user_id)
        if u:
            u.last_seen_at = utcnow()
            db.commit()


@router.websocket("/ws/presence")
async def presence_ws(ws: WebSocket):
    settings = get_settings()
    origin = ws.headers.get("origin")
    # Defesa contra cross-site WebSocket hijacking
    if origin and origin not in settings.cors_origins_list:
        await ws.close(code=4403)
        return
    with SessionLocal() as db:
        user = user_from_token(db, ws.cookies.get(settings.session_cookie_name))
        if user:
            db.expunge(user)
    await ws.accept()
    await hub.connect(ws, user)
    try:
        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict) and msg.get("type") == "beat":
                activity = _activity_from(msg.get("activity")) if user else None
                if await hub.beat(ws, activity) and user:
                    _touch_last_seen(user.id)
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    finally:
        if await hub.disconnect(ws) is not None and user:
            _touch_last_seen(user.id)
