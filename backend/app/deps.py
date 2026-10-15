"""Dependências de request: banco, usuário autenticado, catálogo."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import hash_token
from app.db import get_db
from app.models import AuthSession, User
from app.services.catalog import CatalogService

DB = Annotated[Session, Depends(get_db)]


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite devolve datetimes sem fuso; tudo é gravado em UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if not sess:
        return None
    if as_utc(sess.expires_at) <= datetime.now(UTC):
        db.delete(sess)
        db.commit()
        return None
    return sess.user


def optional_user(request: Request, db: DB) -> User | None:
    return user_from_token(db, request.cookies.get(get_settings().session_cookie_name))


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Entre na sua conta para continuar.")
    return user


def catalog(db: DB) -> CatalogService:
    return CatalogService(db, get_settings())


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
Catalog = Annotated[CatalogService, Depends(catalog)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def require_feature(user: User, feature: str) -> None:
    """D-002/D-011: recursos Premium. Só bloqueia se PREMIUM_ENFORCEMENT estiver ligado."""
    if get_settings().premium_enforcement and user.plan != "premium":
        labels = {
            "review": "Avaliar e escrever críticas",
            "comment": "Comentar",
            "public_list": "Publicar listas",
            "bio": "Editar a bio",
        }
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED, f"{labels.get(feature, 'Este recurso')} é exclusivo do Premium."
        )
