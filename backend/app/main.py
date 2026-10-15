"""Ponto de entrada da API do EUNIS."""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.routers import auth, community, lists, reviews, titles, users
from app.services.presence import hub

log = logging.getLogger("eunis")


def prepare_database() -> None:
    """Aplica migrations pendentes e garante gêneros + catálogo demo (idempotente)."""
    from alembic import command
    from alembic.config import Config

    from app.core.config import BACKEND_DIR
    from app.db import SessionLocal
    from app.services.catalog import ensure_demo_catalog, ensure_genres

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["configure_logger"] = False  # não sobrescrever o logging do uvicorn
    command.upgrade(cfg, "head")
    with SessionLocal() as db:
        ensure_genres(db)
        if get_settings().catalog_source == "demo":
            ensure_demo_catalog(db)


async def _presence_sweeper() -> None:
    from app.routers.community import _touch_last_seen

    while True:
        await asyncio.sleep(10)
        try:
            for uid in await hub.sweep():
                _touch_last_seen(uid)
        except Exception:
            log.exception("falha na varredura de presença")


FIELD_NAMES = {"name": "nome", "username": "@", "email": "e-mail", "password": "senha", "q": "busca", "body": "texto"}


def _first_error(exc: RequestValidationError) -> str:
    for err in exc.errors():
        msg = str(err.get("msg", ""))
        # Mensagens dos nossos validadores vêm como "Value error, <texto>"
        if msg.startswith("Value error, "):
            return msg.removeprefix("Value error, ")
        loc = [str(p) for p in err.get("loc", [])[1:]]
        field = FIELD_NAMES.get(loc[-1], loc[-1]) if loc else "enviado"
        if err.get("type") == "string_too_short":
            return f"O campo {field} está curto demais."
        if err.get("type") == "string_too_long":
            return f"O campo {field} está longo demais."
    return "Dados inválidos."


def create_app(*, prepare_db: bool = True) -> FastAPI:
    settings = get_settings()
    hub.timeout = settings.presence_timeout_seconds

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if prepare_db:
            prepare_database()
        task = asyncio.create_task(_presence_sweeper())
        yield
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422, content={"detail": _first_error(exc), "errors": jsonable_errors(exc)}
        )

    @app.get("/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for r in (auth, titles, reviews, lists, users, community):
        app.include_router(r.router)

    return app


def jsonable_errors(exc: RequestValidationError) -> list[dict]:
    return [{"loc": list(e.get("loc", [])), "msg": str(e.get("msg", ""))} for e in exc.errors()]


app = create_app()
