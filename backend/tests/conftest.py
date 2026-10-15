import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

import app.core.security as security
from app.db import Base, SessionLocal, get_db, make_engine
from app.main import create_app
from app.services.catalog import ensure_demo_catalog
from app.services.presence import hub

# scrypt com custo baixo nos testes (o hash guarda os parâmetros, então a verificação continua correta)
security._N = 2**10


@pytest.fixture
def engine():
    eng = make_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(eng)
    SessionLocal.configure(bind=eng)  # rotas WebSocket usam SessionLocal diretamente
    with SessionLocal() as db:
        ensure_demo_catalog(db)
    yield eng
    eng.dispose()


@pytest.fixture
def client(engine) -> TestClient:
    hub.conns.clear()
    hub.users.clear()
    app = create_app(prepare_db=False)

    def _db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_client(engine):
    """Fábrica de clientes independentes (um por usuário)."""
    apps = []

    def _make() -> TestClient:
        app = create_app(prepare_db=False)
        app.dependency_overrides[get_db] = lambda: (yield from _session())
        c = TestClient(app)
        c.__enter__()
        apps.append(c)
        return c

    def _session():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    yield _make
    for c in apps:
        c.__exit__(None, None, None)


def register(c: TestClient, username: str, password: str = "senha1234") -> dict:
    r = c.post(
        "/api/auth/register",
        json={"name": username.title(), "username": username, "email": f"{username}@test.dev", "password": password},
    )
    assert r.status_code == 201, r.text
    return r.json()
