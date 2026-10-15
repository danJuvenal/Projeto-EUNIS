# EUNIS — Plano de redesign ("reboot")

> Data: 2026-10-15. Escopo autorizado pelo prompt "Reboot do EUNIS": redesign visual completo,
> landing page cinematográfica, área logada com funcionalidades sociais reais e presença online.
> Este plano substitui a ordem incremental de fases da CLAUDE.md §35 para as fases 3–15,
> que passam a ser entregues em conjunto (ver §C). As regras de segurança e de preservação continuam valendo.

---

## A. Diagnóstico

### A.1 Como o projeto está estruturado

| Parte | Estado encontrado |
|---|---|
| `legacy/eunis.html` | MVP completo em um único HTML (~1.400 linhas, JS vanilla, `localStorage`). Referência funcional — **não editado**. |
| `eunis.html` (raiz) | Cópia idêntica (byte a byte) do legado, não versionada. Mantida, sem uso. |
| `frontend/` | React 19 + Vite 8 + TypeScript 6 + Vitest. Apenas uma casca: `App.tsx` com um `<h1>`. 1 teste. |
| `backend/` | FastAPI + pydantic-settings via `uv`. Apenas `/health` + CORS. 1 teste. |
| `database/` | Só README. `docker-compose.yml` com PostgreSQL 18, **nunca executado** (Docker não instalado). |
| `.env` | Inexistente. Nenhuma credencial configurada (TMDb, IA, banco). |
| Git | 2 commits; toda a Fase 2 ainda está fora de commit. |
| Docs | `CLAUDE.md` (regras + roadmap), `docs/analise-fase0.md`, `docs/decisoes.md` (D-001…D-008). |

### A.2 O que já funciona

- Ambiente: Node 24, `uv` + Python 3.12, `npm test`, `uv run pytest`, build do Vite.
- O MVP legado funciona no navegador (dados locais, sem backend).

### A.3 O que é simulado / quebrado no MVP (de `docs/analise-fase0.md`)

- Auth com hash SHA-256 de salt fixo no cliente; autorização só na UI.
- Catálogo fixo de 32 títulos com notas e plataformas não verificadas.
- "Comunidade" = 3 usuários semeados com senha exibida na tela.
- Premium = flag no cliente. Busca por IA depende de `window.claude`.
- Roteador sem URL (sem deep link, sem voltar do navegador). Layout preso a 480 px.

### A.4 O que precisa ser desenvolvido

Banco + migrations, auth real, catálogo (TMDb), avaliações/críticas, curtidas, comentários,
listas, biblioteca (assistidos/quero ver/favoritos), seguir, feed, perfis, presença online,
recomendações, toda a interface nova e a landing page.

### A.5 O que é reaproveitado

- **Stack** (React/Vite/TS, FastAPI/uv, pytest/Vitest) — mantida integralmente.
- **Modelo de dados** do MVP/CLAUDE.md §8 — base das tabelas (com as lacunas da análise: gêneros favoritos, curtidas, tipo filme/série).
- **Catálogo de demonstração** (32 títulos: título, ano, duração, gêneros, temas, sinopse, direção, cores) — vira o *seed* do modo demo. As notas `notaBase` e as plataformas **não** são reaproveitadas (não têm fonte verificável).
- **Heurística de busca local** — base da busca no modo demo.
- **Regras de produto**: uma avaliação por usuário/título, autorização no backend, listas públicas/privadas, gêneros favoritos, onboarding.

### A.6 Restrições do ambiente e decisões derivadas

1. **Sem Docker → sem PostgreSQL local.** O backend usa SQLAlchemy 2 + Alembic e é agnóstico:
   `DATABASE_URL` vazio ⇒ SQLite em `backend/eunis-dev.db`; com `postgresql+psycopg://…` ⇒ PostgreSQL.
   As migrations são as mesmas. (D-009)
2. **Sem `TMDB_API_KEY`.** O cliente TMDb é implementado e ativado automaticamente quando a chave existir.
   Sem a chave, a API serve o **catálogo de demonstração**, e a interface mostra o selo "Catálogo demo".
   Pôsteres do modo demo são **artes tipográficas geradas** (título + cores do MVP) — nunca imagens
   aleatórias que não correspondam ao título. (D-010)
3. **Premium (D-002).** Pagamento não existe (Fase 17). Bloquear avaliações/comentários para quem não é
   Premium tornaria o produto social inutilizável. A regra fica implementada no backend atrás de
   `PREMIUM_ENFORCEMENT` (padrão `false`). **Decisão pendente de revisão do dono do produto.** (D-011)
4. **Presença em tempo real** com WebSocket nativo do FastAPI (sem nova infraestrutura). Instância única;
   para múltiplas instâncias será necessário Redis pub/sub. (D-012)

---

## B. Nova direção visual

### B.1 Conceito: "Sala escura"

O EUNIS é a sala de cinema antes da sessão: escuro quente, luz de projetor, pôsteres como única fonte
de cor. A interface recua; os filmes e as pessoas aparecem. Personalidade vem de **tipografia de cartaz**,
**luz de projetor** (gradientes cônicos/radiais localizados, nunca de fundo inteiro) e **metadados em
estilo de claquete**.

### B.2 Paleta

| Token | Valor | Uso |
|---|---|---|
| `--ink-0` | `#09080B` | fundo da página (carvão quente) |
| `--ink-1` | `#111014` | superfícies |
| `--ink-2` | `#18161C` | superfícies elevadas, inputs |
| `--ink-3` | `#221F27` | hover / chips |
| `--line` | `rgba(244,240,232,.08)` | bordas sutis |
| `--paper` | `#F4F0E8` | texto principal (off-white "papel de cartaz") |
| `--paper-2` | `#A9A3AE` | texto secundário |
| `--paper-3` | `#6E6875` | texto terciário / legendas |
| `--iris` | `#8C6CFF` | acento principal (ações, foco, seleção) |
| `--iris-hi` | `#B7A3FF` | acento em texto sobre escuro |
| `--lamp` | `#FFB648` | luz de projetor: notas, estrelas, destaques quentes |
| `--live` | `#3DDC97` | presença online |
| `--danger` | `#FF6B6B` | erros, exclusão |

Contraste: `--paper` sobre `--ink-0` ≈ 17:1; `--paper-2` ≈ 7.6:1; `--iris-hi` ≈ 8:1 (AA/AAA).

### B.3 Tipografia

- **Display:** Bricolage Grotesque (variável, eixos `wdth`/`opsz`) — títulos de cartaz, condensados e pesados.
- **Texto/UI:** Inter Tight (variável) — leitura densa, números tabulares.
- **Citações de críticas:** Instrument Serif itálico — contraste editorial nas resenhas.
- Fontes servidas localmente via `@fontsource` (sem chamadas a CDN de terceiros).
- Escala fluida com `clamp()`: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 64 / 112 px.

### B.4 Espaçamento, raio e elevação

- Grade de 4 px: `--s-1`…`--s-10` = 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Raios: 8 (chips, inputs), 14 (cards), 22 (painéis), 999 (pílulas). Pôster: 10.
- Elevação por **luz**, não sombra preta: borda `--line` + brilho interno sutil no topo + sombra difusa colorida pela arte do pôster no hover.

### B.5 Componentes

Navbar (transparente → vidro), AppShell (topo no desktop / tab bar inferior no mobile), Poster (imagem
TMDb ou arte tipográfica), TitleCard, RatingStars (meias estrelas, teclado), RatingMeter (barra de
distribuição), ReviewCard, ActivityItem, Avatar (iniciais + matiz determinístico + anel de presença),
PresenceDot, Chip/GenreChip, Tabs, Button (primário/vidro/fantasma), Sheet/Modal, Toast, EmptyState,
ErrorState, Skeleton, ListCover (mosaico de 4 pôsteres).

### B.6 Animações (GSAP + ScrollTrigger)

- Hero: revelação do título linha a linha por máscara, stagger dos CTAs, parede de pôsteres em colunas com
  parallax de rolagem e reação discreta ao mouse.
- Seções: entradas por `ScrollTrigger` (uma vez, sem scrub).
- "Como funciona": linha conectora desenhada com `scrub` (justificativa: comunica progressão da jornada).
- Microinterações: botão magnético (só `pointer: fine`), inclinação 3D em cards, pulso ao curtir,
  "voo" para a lista ao adicionar, transição dos resultados ao mudar filtros, cartas do Match.
- `gsap.context()` / `gsap.matchMedia()` em todo componente; limpeza no unmount; `prefers-reduced-motion`
  desliga movimento e mantém apenas opacidade.

### B.7 Responsividade

Breakpoints: 480 / 768 / 1024 / 1280. Mobile-first. No mobile: tab bar inferior, carrosséis com
scroll-snap, sem tilt/parallax de mouse, alvos de toque ≥ 44 px, parede de pôsteres reduzida a 2 colunas.

### B.8 Referências usadas (princípios, não cópia)

- **Letterboxd (conceito mobile):** perfil como "caixa" pessoal, barra de nota em gradiente, favoritos em destaque.
- **Epic Games Store:** banner de destaque + trilhos organizados + coluna de amigos online.
- **Reelmark:** feed de amigos com cards ricos, chips de ação (Minha lista / Assistido / Avaliar), "Taste profile".
- **Movie tracking app:** estatísticas de perfil (filmes, seguindo, seguidores), abas Assistidos/Quero ver/Críticas.

---

## C. Plano de implementação

1. **Preparação e estrutura** — SQLAlchemy + Alembic, modelos, migration inicial, sessão de banco,
   configuração (`.env.example`), segurança de senha (scrypt), sessão por cookie HttpOnly, proxy do Vite.
2. **Identidade visual e componentes globais** — tokens CSS, fontes, componentes base, AppShell, roteador
   com URLs reais (React Router), contexto de autenticação, toasts.
3. **Landing page** — navbar, hero, descoberta (dados reais da API), comunidade, como funciona,
   usuários online (presença real), CTA final, footer + páginas Sobre/Contato/Privacidade/Termos.
4. **Funcionalidades sociais** — explorar/buscar, detalhes, críticas (CRUD + curtir + comentar),
   biblioteca, listas, perfis, seguir, feed, comunidade, configurações/onboarding de gêneros.
5. **Interações e animações** — GSAP/ScrollTrigger, microinterações, reduced motion.
6. **Dados reais** — cliente TMDb com cache no banco + fallback demo; presença via WebSocket com heartbeat e timeout.
7. **Responsividade** — revisão em 375 / 768 / 1280 px.
8. **Testes e refinamento** — pytest (auth, autorização, críticas, listas, presença, compatibilidade),
   Vitest (componentes), build, verificação no navegador.

### Ideias diferenciais escolhidas

| Ideia | Implementação | Por quê |
|---|---|---|
| **Match cinematográfico** | Baralho de cartas (Quero ver / Já vi / Passo) ordenado por afinidade de gêneros calculada de favoritos + notas, com o motivo visível | Descoberta ativa e alimenta a biblioteca |
| **Compatibilidade entre usuários** | Similaridade das notas em títulos em comum (mín. 3) + cosseno dos perfis de gênero; sem dados suficientes, a tela diz isso | Pedido explícito de não inventar porcentagens |
| **Listas compartilháveis** | Listas públicas com URL própria, capa em mosaico | Já existia no MVP |
| **Atividade da comunidade** | Tabela `activities` gerada por eventos reais | Feed e landing honestos |
| **Perfil de gosto** | Distribuição de gêneros das notas do usuário | Inspirado no "Taste profile" |

Fora de escopo agora (anotado): busca por IA (Fase 9, sem provider), pagamentos, recuperação de senha
por e-mail (sem provedor de e-mail), notificações push, moderação/denúncias.
