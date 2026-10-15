"""Configuração da aplicação, lida de variáveis de ambiente e do .env na raiz do repositório."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py → raiz do repositório
ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",  # o .env é compartilhado; variáveis de outras partes são ignoradas aqui
    )

    app_name: str = "EUNIS API"
    app_env: str = "development"
    # Lista separada por vírgula, ex.: "http://localhost:5173,https://eunis.app"
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # Banco. Vazio = SQLite local em backend/eunis-dev.db (D-009).
    # PostgreSQL: postgresql+psycopg://usuario:senha@localhost:5432/eunis
    database_url: str = ""

    # Sessão por cookie HttpOnly (token opaco; só o hash fica no banco)
    session_cookie_name: str = "eunis_session"
    session_days: int = 30

    # Catálogo. Vazio = catálogo de demonstração (D-010).
    tmdb_api_key: str = ""
    tmdb_language: str = "pt-BR"
    tmdb_region: str = "BR"

    # D-002 / D-011: exigir Premium para avaliar, comentar, publicar listas e editar bio.
    # Desligado enquanto não existe pagamento real (Fase 17).
    premium_enforcement: bool = False

    # Presença: sem heartbeat por este tempo, o usuário sai da lista de online.
    presence_timeout_seconds: int = 70

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite:///{(BACKEND_DIR / 'eunis-dev.db').as_posix()}"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def catalog_source(self) -> str:
        return "tmdb" if self.tmdb_api_key else "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
