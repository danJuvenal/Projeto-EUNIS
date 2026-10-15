"""Esquemas de entrada (validação). As saídas são montadas em app/serializers.py."""

import re

from pydantic import BaseModel, Field, field_validator

USERNAME_RX = re.compile(r"^[a-z0-9_.]{3,24}$")
EMAIL_RX = re.compile(r"^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$")


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    username: str
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Informe seu nome.")
        return v

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower().lstrip("@")
        if not USERNAME_RX.match(v):
            raise ValueError("Use 3 a 24 caracteres: letras minúsculas, números, _ ou .")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RX.match(v):
            raise ValueError("E-mail inválido.")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("A senha precisa ter letras e números.")
        return v


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    bio: str | None = Field(default=None, max_length=280)
    avatar_hue: int | None = Field(default=None, ge=0, le=359)
    show_online: bool | None = None
    favorite_genres: list[str] | None = Field(default=None, max_length=8)
    onboarded: bool | None = None


class ReviewIn(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=10)
    body: str = Field(default="", max_length=5000)
    spoilers: bool = False

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        return v.strip()


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Escreva alguma coisa.")
        return v


class LibraryIn(BaseModel):
    watchlist: bool | None = None
    watched: bool | None = None
    favorite: bool | None = None
    dismissed: bool | None = None


class ListIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)
    is_public: bool = False


class ListUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None


class ListItemIn(BaseModel):
    title_id: int
