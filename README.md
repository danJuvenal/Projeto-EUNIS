# EUNIS

Plataforma de descoberta, busca e organização de filmes e séries, com **busca por intenção em linguagem natural**.

> "Quero um filme de terror psicológico, sem muito jumpscare, com menos de duas horas."

## Status

Em migração de um protótipo local (HTML único + `localStorage`) para uma aplicação web com frontend, backend e banco de dados.

| Fase | Situação |
|---|---|
| 0 — Análise | Concluída — [`docs/analise-fase0.md`](docs/analise-fase0.md) |
| 1 — Estrutura | Concluída |
| 2 — Stack e ambiente | Em andamento |
| 3+ | Não iniciadas |

Roadmap completo: [`CLAUDE.md`](CLAUDE.md) §35–§37.

## Estrutura

```text
Aplicativo_filmes/
├── frontend/          # React (Fase 2) — testes em frontend/tests/
├── backend/           # FastAPI (Fase 4) — testes em backend/tests/
├── database/          # PostgreSQL: migrations e seeds (Fase 3)
├── docs/              # análise, decisões e referências
│   └── legacy/        # definições .d.ts do runtime de Artifacts do Claude
├── scripts/           # utilitários de desenvolvimento
├── legacy/            # MVP original (eunis.html), preservado sem alterações
├── .env.example       # modelo de variáveis de ambiente
├── CLAUDE.md          # contexto, regras e roadmap
└── README.md
```

## Stack (direção)

- **Frontend:** React
- **Backend:** Python + FastAPI
- **Banco:** PostgreSQL
- **Testes:** pytest (backend), framework a definir (frontend)

## Protótipo

Abra `legacy/eunis.html` no navegador. Detalhes em [`legacy/README.md`](legacy/README.md).

## Configuração

```bash
cp .env.example .env   # preencha os valores localmente; nunca commite o .env
```

Instruções de instalação e execução serão adicionadas a partir da Fase 2.

## Documentação

- [`docs/analise-fase0.md`](docs/analise-fase0.md) — análise do MVP
- [`docs/decisoes.md`](docs/decisoes.md) — decisões técnicas e de produto
