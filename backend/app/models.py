"""Modelos do banco (SQLAlchemy 2). Schema versionado em backend/alembic/versions."""

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


# ---------------------------------------------------------------- usuários


class User(Timestamps, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(60))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str] = mapped_column(String(280), default="")
    plan: Mapped[str] = mapped_column(String(16), default="free")
    avatar_hue: Mapped[int] = mapped_column(Integer, default=262)
    # Privacidade
    show_online: Mapped[bool] = mapped_column(Boolean, default=True)
    # Contas criadas pelo seed de demonstração; a interface sempre as identifica como "demo"
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    favorite_genres: Mapped[list["Genre"]] = relationship(secondary="user_genres", lazy="selectin")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="joined")


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (CheckConstraint("follower_id <> followee_id", name="ck_follow_self"),)

    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    followee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------- catálogo


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    tmdb_movie_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tmdb_tv_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class UserGenre(Base):
    __tablename__ = "user_genres"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True
    )


class Title(Timestamps, Base):
    __tablename__ = "titles"

    id: Mapped[int] = mapped_column(primary_key=True)
    # "demo:c01" | "tmdb:movie:550" | "tmdb:tv:1396"
    external_key: Mapped[str] = mapped_column(String(64), unique=True)
    source: Mapped[str] = mapped_column(String(8), index=True)
    media_type: Mapped[str] = mapped_column(String(8), index=True)  # movie | tv
    title: Mapped[str] = mapped_column(String(255))
    original_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    runtime_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seasons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poster_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    backdrop_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    director: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cast: Mapped[list] = mapped_column(JSON, default=list)
    themes: Mapped[list] = mapped_column(JSON, default=list)
    country: Mapped[str | None] = mapped_column(String(8), nullable=True)
    # Cores da arte tipográfica (modo demo) — [c1, c2]
    palette: Mapped[list] = mapped_column(JSON, default=list)
    tmdb_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    tmdb_votes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    popularity: Mapped[float] = mapped_column(Float, default=0)
    details_loaded: Mapped[bool] = mapped_column(Boolean, default=False)

    genres: Mapped[list[Genre]] = relationship(secondary="title_genres", lazy="selectin")


class TitleGenre(Base):
    __tablename__ = "title_genres"

    title_id: Mapped[int] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True, index=True
    )


# ---------------------------------------------------------------- social


class Review(Timestamps, Base):
    """Avaliação + crítica. Uma por usuário/título (CLAUDE.md §19)."""

    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "title_id", name="uq_review_user_title"),
        # Nota em meias estrelas: 1..10 = 0,5..5 estrelas
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 10)", name="ck_review_rating"),
        Index("ix_reviews_title_created", "title_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title_id: Mapped[int] = mapped_column(ForeignKey("titles.id", ondelete="CASCADE"))
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body: Mapped[str] = mapped_column(Text, default="")
    spoilers: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(lazy="joined")
    title: Mapped[Title] = relationship(lazy="joined")


class ReviewLike(Base):
    __tablename__ = "review_likes"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Comment(Timestamps, Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(String(1000))

    user: Mapped[User] = relationship(lazy="joined")


class LibraryEntry(Base):
    """Estado pessoal de um título: quero ver, assistido, favorito, descartado no Match."""

    __tablename__ = "library_entries"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    title_id: Mapped[int] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), primary_key=True
    )
    watchlist: Mapped[bool] = mapped_column(Boolean, default=False)
    watched: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    watched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    title: Mapped[Title] = relationship(lazy="joined")


class UserList(Timestamps, Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(500), default="")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(lazy="joined")
    items: Mapped[list["ListItem"]] = relationship(
        lazy="selectin", order_by="ListItem.position", cascade="all, delete-orphan"
    )


class ListItem(Base):
    __tablename__ = "list_items"
    __table_args__ = (UniqueConstraint("list_id", "title_id", name="uq_list_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("lists.id", ondelete="CASCADE"), index=True)
    title_id: Mapped[int] = mapped_column(ForeignKey("titles.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    title: Mapped[Title] = relationship(lazy="joined")


class Activity(Base):
    """Eventos sociais reais que alimentam feed, comunidade e landing."""

    __tablename__ = "activities"
    __table_args__ = (Index("ix_activities_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # review | watched | watchlist | favorite | list_created | list_item | follow
    kind: Mapped[str] = mapped_column(String(20))
    title_id: Mapped[int | None] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), nullable=True
    )
    review_id: Mapped[int | None] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), nullable=True
    )
    list_id: Mapped[int | None] = mapped_column(
        ForeignKey("lists.id", ondelete="CASCADE"), nullable=True
    )
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")
    title: Mapped[Title | None] = relationship(lazy="joined")
    review: Mapped[Review | None] = relationship(lazy="joined")
    list: Mapped[UserList | None] = relationship(lazy="joined")
    target_user: Mapped[User | None] = relationship(foreign_keys=[target_user_id], lazy="joined")
