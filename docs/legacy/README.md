# docs/legacy/

Definições de tipo (`.d.ts`, comentários em português) do runtime de **Artifacts do Claude** — a API `window.claude.use(...)` disponível quando o protótipo roda como Artifact.

Não fazem parte do produto EUNIS. Ficam aqui apenas como referência do ambiente em que o MVP (`legacy/eunis.html`) foi construído.

## Uso pelo protótipo

| Capacidade | Usada? | Onde no `eunis.html` |
|---|---|---|
| `sample` | Sim | `buscarIA()` — busca por intenção com LLM |
| `downloads` | Sim | `baixar()` — exportação do banco em JSON |
| `artifact`, `self`, `assets`, `comments`, `db`, `mcp`, `permissions`, `room`, `user`, `claude` | Não | — |

Na arquitetura alvo, a IA passa a ser chamada pelo **backend** (Fase 9), e estas definições deixam de ser necessárias.
