"""Autenticação: cadastro, login, logout, /me e edição do próprio perfil."""

import random
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.security import DUMMY_HASH, hash_password, hash_token, new_session_token, verify_password
from app.deps import DB, CurrentUser, OptionalUser, require_feature
from app.models import AuthSession, Genre, User
from app.schemas import LoginIn, ProfileUpdateIn, RegisterIn
from app.serializers import user_private
from app.services.presence import hub

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Limite simples de tentativas de login por IP+e-mail (instância única).
_ATTEMPTS: dict[str, deque] = defaultdict(deque)
MAX_ATTEMPTS, WINDOW_S = 8, 300


def _check_rate(key: str) -> None:
    q = _ATTEMPTS[key]
    now = time.monotonic()
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    if len(q) >= MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        )
    q.append(now)


def _start_session(db, response: Response, user: User) -> None:
    s = get_settings()
    token = new_session_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + timedelta(days=s.session_days),
        )
    )
    db.commit()
    response.set_cookie(
        s.session_cookie_name,
        token,
        max_age=s.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=s.is_production,
        path="/",
    )


@router.post("/register", status_code=201)
def register(data: RegisterIn, db: DB, response: Response):
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Esse e-mail já tem conta. Entre em vez de criar.")
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Esse @ já está em uso.")
    user = User(
        name=data.name,
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        avatar_hue=random.randint(0, 359),
    )
    db.add(user)
    db.commit()
    _start_session(db, response, user)
    return user_private(user)


@router.post("/login")
def login(data: LoginIn, db: DB, request: Request, response: Response):
    email = data.email.strip().lower()
    _check_rate(f"{request.client.host if request.client else '?'}|{email}")
    user = db.scalar(select(User).where(User.email == email))
    # Sempre verifica um hash, exista ou não a conta (tempo constante)
    ok = verify_password(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha não conferem.")
    _start_session(db, response, user)
    return user_private(user)


@router.post("/logout", status_code=204)
def logout(db: DB, request: Request, response: Response):
    s = get_settings()
    token = request.cookies.get(s.session_cookie_name)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        db.commit()
    response.delete_cookie(s.session_cookie_name, path="/")


@router.get("/me")
def me(user: OptionalUser):
    return {"user": user_private(user) if user else None}


@router.patch("/me")
def update_me(data: ProfileUpdateIn, user: CurrentUser, db: DB):
    if data.name is not None:
        user.name = " ".join(data.name.split())
    if data.bio is not None and data.bio.strip() != user.bio:
        require_feature(user, "bio")
        user.bio = data.bio.strip()
    if data.avatar_hue is not None:
        user.avatar_hue = data.avatar_hue
    if data.show_online is not None:
        user.show_online = data.show_online
    if data.onboarded is not None:
        user.onboarded = data.onboarded
    if data.favorite_genres is not None:
        user.favorite_genres = list(db.scalars(select(Genre).where(Genre.slug.in_(data.favorite_genres))))
    db.commit()
    hub.update_user_info(user)
    return user_private(user)
