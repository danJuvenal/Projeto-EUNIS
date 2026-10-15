# backend/

API do EUNIS — **Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic**, gerenciada com [uv](https://docs.astral.sh/uv/).

## Estrutura

```text
backend/
├── app/
│   ├── core/config.py        # Settings (lê o .env da raiz)
│   ├── core/security.py      # hash scrypt, tokens de sessão
│   ├── db.py                 # engine/sessão (SQLite local ou PostgreSQL)
│   ├── models.py             # tabelas
│   ├── schemas.py            # validação de entrada
│   ├── serializers.py        # respostas (sem dados privados de terceiros)
│   ├── deps.py               # usuário atual, catálogo, regra Premium
│   ├── routers/              # auth, titles, reviews, lists, users, community (+ WebSocket)
│   ├── services/catalog.py   # TMDb + catálogo demo + cache
│   ├── services/presence.py  # presença em tempo real (heartbeat/timeout)
│   ├── services/social.py    # atividades, afinidade, Match, compatibilidade
│   ├── seed.py               # comunidade demo opcional (contas is_demo)
│   └── main.py               # create_app(), migrations no startup, varredura de presença
├── alembic/                  # migrations
├── tests/                    # pytest (33 testes)
└── pyproject.toml / uv.lock
```

## Comandos (dentro de `backend/`)

```bash
uv sync                                   # instala tudo
uv run uvicorn app.main:app --reload      # http://localhost:8000 (docs: /docs)
uv run python -m app.seed                 # opcional: 3 contas demo + críticas/listas (só dev)
uv run pytest                             # testes
uv run alembic revision --autogenerate -m "mensagem"   # nova migration após mudar models.py
uv run alembic upgrade head               # aplicar migrations (o startup já faz isso)
```

> Se `uv run pytest` falhar com "trampoline failed to canonicalize script path" (launcher antigo após
> renomear a pasta), rode `uv sync --reinstall-package pytest` ou use `uv run python -m pytest`.

## Banco

- `DATABASE_URL` vazio ⇒ SQLite em `backend/eunis-dev.db` (ignorado pelo Git). D-009.
- PostgreSQL: `DATABASE_URL=postgresql+psycopg://eunis:<senha>@localhost:5432/eunis` (ver `docker-compose.yml`).
- Para recomeçar o banco local, pare o servidor e apague `backend/eunis-dev.db` (só dados de desenvolvimento).

## Endpoints principais

| Área | Rotas |
|---|---|
| Auth | `POST /api/auth/register` · `login` · `logout` · `GET/PATCH /api/auth/me` |
| Catálogo | `GET /api/catalog/status` · `/api/genres` · `/api/titles` (q, type, genre, sort, page) · `/api/titles/trending` · `/api/titles/{id}` · `/related` |
| Críticas | `GET /api/titles/{id}/reviews` · `PUT /api/titles/{id}/review` · `DELETE /api/reviews/{id}` · `PUT/DELETE /api/reviews/{id}/like` · `GET/POST /api/reviews/{id}/comments` · `DELETE /api/comments/{id}` |
| Biblioteca | `PUT /api/titles/{id}/library` (watchlist, watched, favorite, dismissed) |
| Listas | `GET /api/lists` · `/mine` · `POST /api/lists` · `GET/PATCH/DELETE /api/lists/{id}` · `POST/DELETE /api/lists/{id}/items` |
| Perfis | `GET /api/users` · `/api/users/{u}` · `/library` · `/reviews` · `/lists` · `/followers` · `/following` · `PUT/DELETE /follow` · `GET /compat` |
| Social | `GET /api/feed` · `/api/community/activity` · `/api/community/stats` · `/api/match` |
| Presença | `WS /api/ws/presence` · `GET /api/presence/online` |

## Regras

- Secrets só via `.env`. Autorização sempre no backend (dono da crítica/lista/comentário).
- Listas privadas de terceiros respondem 404; e-mail nunca sai em respostas públicas.
