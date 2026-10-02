# Análise do MVP — Fase 0

> Data: 2026-10-02. Analisado: `legacy/eunis.html` (1.385 linhas, ~89 KB).
> Referências de linha são do arquivo `legacy/eunis.html`.

## 1. Estrutura do protótipo

Um único arquivo HTML com CSS e JavaScript vanilla, sem bibliotecas nem build.

| Linhas | Bloco |
|---|---|
| 10–265 | CSS: design tokens, tema claro/escuro, componentes |
| 282–309 | Utilitários (`el`, `esc`, `uid`, `desde`, `avisar`) e filtro de palavrões |
| 314–348 | `Banco`: persistência em `localStorage` (chave `eunis.db.v1`) |
| 351–390 | Catálogo fixo: 11 gêneros, 20 temas, 32 títulos |
| 395–461 | Autenticação (`hash`, `Sessao`, `cadastrar`, `entrar`) e semente da comunidade |
| 466–573 | Busca: `buscarLocal`, `buscarIA`, `buscarPorFiltros` |
| 578–631 | Componentes (`cartaz`, `linhaConteudo`, `avatar`, `abrirFolha`, `exigirPremium`) |
| 636–672 | Roteador em memória (`ir`, `voltarRota`, `render`) — sem URLs |
| 677–1363 | Telas |
| 1368–1382 | Tema e boot |

O código cita um "PRD" (§10, §15, §19, RF01–RF08) que não existe no projeto.

## 2. Telas (rotas)

`abertura`, `cadastro`, `login`, `recuperar`, `onboarding`, `inicio`, `buscar`/`filtros`, `resultadosIA`, `resultados`, `conteudo` (abas Comentários / Avaliações / Parecidos), `listas`, `lista`, `perfil`, `config`, `metricas`.

## 3. Dados (`localStorage`)

`usuarios` (com `generosFav` e `config`), `sessao`, `catalogo`, `generos`, `temas`, `avaliacoes`, `comentarios` (com array `curtidas`), `listas`, `itensLista`, `eventos` (limite de 900).

## 4. Real × simulado

| Funcionalidade | Classificação |
|---|---|
| UI, navegação, tema, filtro de palavrões | Real (só cliente) |
| Busca local heurística e filtros | Real, sobre catálogo de demonstração |
| Avaliações, comentários, curtidas, listas | Locais (por navegador) |
| Cadastro, login, sessão | Simulados / inseguros |
| Recuperação de senha | Simulada (só toast) |
| Catálogo, plataformas, "em alta" | Simulados (fixos; "em alta" = ordenação por nota) |
| Comunidade (usuários, comentários, listas) | Semente fixa |
| Premium | Simulado (`u.plano = "premium"`) |
| Métricas | Locais |
| Busca por IA | API externa via `window.claude` (só no runtime de Artifacts); fallback local já existe |

## 5. Riscos técnicos

### Segurança
1. Hash de senha SHA-256 com salt fixo no cliente; fallback djb2 (linhas 395–400).
2. Senha das contas de teste exibida na tela de login (linha 754).
3. Toda autorização apenas na UI (lista privada l.1218, apagar comentário l.1067, Premium).
4. Exportação entrega o banco inteiro, com e-mails e hashes de todos os usuários (l.1331).
5. "Apagar todos os dados" apaga dados de todos os usuários.
6. Tela de métricas acessível a qualquer usuário.
7. Texto do usuário interpolado no prompt da IA sem delimitação (prompt injection; impacto atual baixo porque os IDs retornados são validados).
8. Eventos registram e-mail e texto de busca.
9. `el()` aceita opção `html` (innerHTML) — não usada hoje; `esc()` existe e também não é usada.

### Dados e regras
10. Escalas de nota inconsistentes: `notaBase` 0–10, avaliação 1–5, combinação arbitrária em `nota()` (l.467).
11. Duração como string (`"2h12"`, `"2 temporadas"`); filtro "curto" via regex `/^1h/`.
12. Gênero "Música" usado em c10/c19 mas ausente de `GENEROS`.
13. Lista `BRASILEIROS` duplicada (l.466 e l.516); não há campo de país.
14. Editar avaliação sobrescreve `criadoEm`; não há `updated_at`.
15. Catálogo gravado no `localStorage` no primeiro uso — atualizações no código não chegam a bancos existentes.
16. Expiração de sessão verificada só no boot.
17. "Pular" no onboarding faz o usuário voltar ao onboarding a cada login.
18. Nomes de eventos diferentes dos da CLAUDE.md §25; logout não registra evento.

### Arquitetura
19. Monólito em um arquivo; telas mutam `Banco.d` diretamente, sem camada de serviço.
20. Roteador sem URL: sem deep links, sem botão voltar do navegador, sem links compartilháveis.
21. Layout mobile-first com largura máxima de 480px — decisão de design a revisar.

## 6. Atual × alvo

| Aspecto | Atual | Alvo |
|---|---|---|
| Frontend | HTML único, vanilla JS | React modular |
| Backend | Inexistente | FastAPI |
| Banco | `localStorage` | PostgreSQL + migrations |
| Auth | Cliente | Hash no servidor, token seguro |
| Autorização | Só UI | Backend |
| Catálogo | 32 títulos fixos | TMDb + cache |
| IA | `window.claude` sample | LLM no backend + saída estruturada + fallback |
| Analytics | Array local | Backend |
| Premium | Flag no cliente | Gateway + webhook |
| Testes | Nenhum | pytest + testes de frontend |

## 7. Aproveitável

- Design system (tokens CSS, temas claro/escuro).
- Fluxo de telas e textos de UX.
- Heurística de `buscarLocal` como base do fallback da IA (CLAUDE.md §17).
- Prompt da busca por IA como ponto de partida.
- Modelo de dados próximo das entidades da §8.

## 8. Entidades ausentes na CLAUDE.md §8

Necessárias para preservar o comportamento do MVP:

- favoritos de gênero por usuário (`generosFav`)
- curtidas de comentário (`curtidas`)
- temas / keywords dos títulos
- plataformas de exibição (watch providers)
- `type` (filme/série) e país de origem no conteúdo
