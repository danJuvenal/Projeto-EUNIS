# database/

Migrations, seeds e documentação do banco do EUNIS.

**Status:** schema criado com SQLAlchemy + Alembic em `backend/alembic/versions/` (D-009). Sem `DATABASE_URL`, o backend usa SQLite em `backend/eunis-dev.db`; o mesmo schema roda em PostgreSQL.

## PostgreSQL local (Docker Compose)

Decisão D-008 em [`docs/decisoes.md`](../docs/decisoes.md). O serviço está em `../docker-compose.yml`.

Pré-requisito: Docker Desktop (com WSL2).

```bash
cp .env.example .env                 # na raiz; defina POSTGRES_PASSWORD e DATABASE_URL
docker compose up -d db              # sobe o PostgreSQL 18 em 127.0.0.1:5432
docker compose ps                    # deve mostrar "healthy"
docker compose down                  # para (dados preservados no volume)
docker compose down -v               # para e apaga os dados
```

## Observações

- O `localStorage` do protótipo não é banco de produção e não será migrado como fonte de dados.
- Entidades iniciais: CLAUDE.md §8. Lacunas identificadas na análise (favoritos de gênero, curtidas, temas, plataformas): [`docs/analise-fase0.md`](../docs/analise-fase0.md).
