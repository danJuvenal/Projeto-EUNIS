# EUNIS

Plataforma de descoberta, busca e organização de filmes e séries, com **busca por intenção em linguagem natural**.

> "Quero um filme de terror psicológico, sem muito jumpscare, com menos de duas horas."

## Status

Reboot de 2026-10-15 ([`EUNIS_REDESIGN_PLAN.md`](EUNIS_REDESIGN_PLAN.md)): landing page, catálogo, críticas,
listas, perfis, feed, Match, compatibilidade e presença online em tempo real funcionando com backend e banco reais.

| Recurso | Situação |
|---|---|
| Banco | SQLite local por padrão; PostgreSQL via `DATABASE_URL` (Docker pendente) |
| Catálogo | Demo (32 títulos) sem chave; TMDb com `TMDB_API_KEY` |
| Busca por IA, pagamentos, e-mail | Não implementados |

Roadmap original: [`CLAUDE.md`](CLAUDE.md) §35–§37 e §43.

## Estrutura

```text
Aplicativo_filmes/
├── frontend/            # React + Vite + TypeScript — testes em frontend/tests/
├── backend/             # Python 3.12 + FastAPI (uv) — testes em backend/tests/
├── database/            # PostgreSQL: migrations e seeds (Fase 3)
├── docs/                # análise, decisões e referências
│   └── legacy/          # definições .d.ts do runtime de Artifacts do Claude
├── scripts/             # utilitários de desenvolvimento
├── legacy/              # MVP original (eunis.html), preservado sem alterações
├── docker-compose.yml   # PostgreSQL 18 local
├── .env.example         # modelo de variáveis de ambiente
├── CLAUDE.md            # contexto, regras e roadmap
└── README.md
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 6, React Router 8, GSAP 3 (Node 24 LTS) |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Uvicorn, pydantic-settings (uv) |
| Banco | SQLite (dev) / PostgreSQL 18 via Docker Compose |
| Testes | pytest (backend), Vitest + Testing Library (frontend) |

Justificativas: [`docs/decisoes.md`](docs/decisoes.md) (D-006 a D-015).

## Pré-requisitos

- [uv](https://docs.astral.sh/uv/) — instala o Python 3.12 automaticamente
- Node.js 24 LTS
- Docker Desktop (a partir da Fase 3)

## Configuração

```bash
cp .env.example .env   # preencha os valores localmente; nunca commite o .env
```

## Execução

Dois terminais:

```bash
# 1) Backend — http://localhost:8000 (docs em /docs). Cria/migra o banco SQLite sozinho.
cd backend
uv sync
uv run python -m app.seed          # opcional: comunidade demo (contas marcadas como demo)
uv run uvicorn app.main:app --reload

# 2) Frontend — http://localhost:5173 (proxy de /api e do WebSocket para o backend)
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173 e crie uma conta. Para ver a presença em tempo real, abra uma segunda
janela anônima com outra conta.

PostgreSQL (opcional, requer Docker): `docker compose up -d db` e defina `DATABASE_URL` no `.env`.

## Testes

```bash
cd backend  && uv run pytest
cd frontend && npm test
```

Detalhes: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md), [`database/README.md`](database/README.md).

## Protótipo

Abra `legacy/eunis.html` no navegador. Detalhes em [`legacy/README.md`](legacy/README.md).

## Documentação

- [`docs/analise-fase0.md`](docs/analise-fase0.md) — análise do MVP
- [`docs/decisoes.md`](docs/decisoes.md) — decisões técnicas e de produto
