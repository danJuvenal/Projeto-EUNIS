# legacy/

MVP original do EUNIS, preservado **sem modificações** como referência visual e funcional durante a migração (ver CLAUDE.md §26 e §27).

| Arquivo | Descrição |
|---|---|
| `eunis.html` | Protótipo navegável completo (HTML + CSS + JS em um arquivo, dados em `localStorage`) |

## Como abrir

Abra `eunis.html` diretamente no navegador. Não há build nem dependências.

- Os dados ficam no `localStorage` do navegador (chave `eunis.db.v1`).
- A busca por IA só funciona dentro do runtime de Artifacts do Claude (`window.claude`). Fora dele, o protótipo usa automaticamente a busca local heurística.
- Contas de teste semeadas: `julia@eunis.app`, `pedro@eunis.app`, `mariana@eunis.app` — senha `eunis1234`.

## Regras

- **Não editar** este arquivo. Ele é a referência do comportamento atual.
- Só remover quando todas as funcionalidades tiverem substituição testada na nova arquitetura.
- Análise completa do protótipo: [`docs/analise-fase0.md`](../docs/analise-fase0.md).
