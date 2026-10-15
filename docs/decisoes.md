# Decisões técnicas e de produto

Registro das decisões aprovadas. Cada entrada indica data, contexto e impacto.

---

## D-001 — Arquivos `.d.ts` mantidos como referência

- **Data:** 2026-10-02 (Fase 1)
- **Decisão:** as definições de tipo do runtime de Artifacts do Claude foram movidas para `docs/legacy/`, sem alteração. Não devem ser apagadas.
- **Motivo:** documentam o ambiente em que o MVP foi construído (`window.claude.use("sample")` e `use("downloads")`).

## D-002 — Regras de Premium preservadas como requisito

- **Data:** 2026-10-02 (Fase 1)
- **Decisão:** as regras de acesso do protótipo continuam válidas. São exclusivas do plano Premium:
  1. Avaliar títulos
  2. Comentar
  3. Publicar listas (tornar lista pública)
  4. Editar/personalizar a bio do perfil
- **Plano gratuito mantém:** catálogo completo, busca por IA, listas privadas, leitura de comentários, avaliações e listas da comunidade.
- **Restrições:**
  - Não implementar pagamento real ainda (Fase 17).
  - Na arquitetura nova, essas regras devem ser validadas **no backend** (o protótipo valida apenas na UI, em `exigirPremium()`).
  - `plano = "premium"` no cliente não é assinatura real.

## D-003 — Testes separados por projeto

- **Data:** 2026-10-02 (Fase 1)
- **Decisão:** testes ficam em `backend/tests/` e `frontend/tests/`. Não existe pasta `tests/` na raiz.
- **Impacto:** a estrutura de pastas da CLAUDE.md §7 lista `tests/` na raiz; esta decisão a substitui.

## D-004 — MVP preservado em `legacy/`

- **Data:** 2026-10-02 (Fase 1)
- **Decisão:** `eunis.html` foi movido para `legacy/eunis.html` sem modificações (verificado por SHA-256) e serve de referência até existir substituição funcional.

## D-005 — Fins de linha normalizados em LF

- **Data:** 2026-10-02 (Fase 1)
- **Decisão:** `.gitattributes` com `* text=auto eol=lf`.
- **Motivo:** o Git local usa `core.autocrlf`; sem a regra, arquivos seriam convertidos para CRLF em checkouts, gerando diffs espúrios entre Windows e outros ambientes (deploy, CI).

## D-006 — Backend: Python 3.12 gerenciado pelo uv

- **Data:** 2026-10-02 (Fase 2)
- **Decisão:** `uv` como gerenciador de ambiente virtual, dependências e versão do Python. Python fixado em 3.12 (`backend/.python-version`, `requires-python = ">=3.12,<3.13"`). Lockfile `backend/uv.lock` versionado.
- **Motivo:** o `uv` já estava instalado; instala o Python 3.12 por usuário sem alterar o Python 3.14 do sistema; um único comando (`uv sync`) reproduz o ambiente.
- **Dependências:** `fastapi`, `uvicorn[standard]`, `pydantic-settings`; dev: `pytest`, `httpx2` (exigido pelo `TestClient` do Starlette 1.x — o `httpx` clássico gera aviso de obsolescência).
- **Configuração:** `pydantic-settings` lê o `.env` da raiz; variáveis de fases futuras são ignoradas.

## D-007 — Frontend: React + Vite + TypeScript, Node 24 LTS

- **Data:** 2026-10-02 (Fase 2)
- **Decisão:** template oficial `react-ts` do Vite (sem o conteúdo de demonstração), TypeScript em modo `strict`, Vitest com jsdom e Testing Library, `oxlint` (linter padrão do template). Node.js 24 LTS instalado via `winget`. Lockfile `frontend/package-lock.json` versionado.
- **Porta:** 5173 fixa (`strictPort`), alinhada com `CORS_ORIGINS` do backend.

## D-008 — PostgreSQL via Docker Compose

- **Data:** 2026-10-02 (Fase 2)
- **Decisão:** PostgreSQL 18 (`postgres:18-alpine`) em `docker-compose.yml` na raiz, exposto só em `127.0.0.1`, com volume nomeado e healthcheck. Credenciais no `.env` (a senha é obrigatória, sem valor padrão).
- **Motivo:** versão fixada e idêntica para qualquer máquina, banco descartável, sem instalação nativa no Windows; aproxima o ambiente local do deploy.
- **Pendência:** Docker Desktop (com WSL2) ainda não está instalado nesta máquina. O arquivo foi validado sintaticamente, mas o container nunca foi executado. Instalar antes da Fase 3.

---

# Reboot do EUNIS (2026-10-15)

Contexto: prompt "Reboot do EUNIS" autorizou redesign completo + funcionalidades sociais. Plano em [`EUNIS_REDESIGN_PLAN.md`](../EUNIS_REDESIGN_PLAN.md).

## D-009 — Banco agnóstico: SQLite local, PostgreSQL quando configurado

- **Decisão:** SQLAlchemy 2 + Alembic. `DATABASE_URL` vazio ⇒ SQLite em `backend/eunis-dev.db`; com URL `postgresql+psycopg://` ⇒ PostgreSQL. Mesmas migrations (`render_as_batch` para ALTERs no SQLite).
- **Motivo:** Docker Desktop ainda não está instalado (pendência de D-008); o app precisava persistir dados de verdade já. D-008 continua sendo o alvo.
- **Startup:** a API aplica `alembic upgrade head` ao iniciar e garante gêneros + catálogo demo (idempotente).

## D-010 — Catálogo: TMDb com fallback para catálogo demo

- **Decisão:** cliente TMDb no backend (chave nunca no frontend), resultados gravados na tabela `titles` + cache de listas em memória (30 min). Sem `TMDB_API_KEY`, a API serve os 32 títulos do MVP e responde `source: "demo"`; a interface exibe o selo "Catálogo demo".
- **Honestidade:** `notaBase` e plataformas do MVP **não** foram reaproveitadas (sem fonte). Pôsteres do modo demo são artes tipográficas geradas com título e cores do próprio título. Notas exibidas são só da comunidade EUNIS (e do TMDb, quando configurado, rotulada como tal).

## D-011 — Regras Premium atrás de flag (pendente de revisão)

- **Decisão:** as regras de D-002 estão implementadas no backend (`require_feature`), mas só bloqueiam com `PREMIUM_ENFORCEMENT=true`. Padrão: `false`.
- **Motivo:** sem pagamento real (Fase 17), bloquear críticas e comentários inviabiliza a parte social pedida no reboot.
- **Pendência:** o dono do produto precisa confirmar se D-002 continua valendo no lançamento.

## D-012 — Presença online via WebSocket nativo do FastAPI

- **Decisão:** `WS /api/ws/presence` com identidade lida do cookie de sessão no handshake (nunca do cliente), heartbeat a cada 25 s, varredura a cada 10 s e timeout de 70 s (não depende do evento de fechar a aba). O cliente informa só o tipo de atividade e um id; o texto ("Vendo Duna") é montado no servidor. Origem do handshake validada contra `CORS_ORIGINS`. `show_online=false` deixa o usuário invisível.
- **Limite:** estado em memória — vale para uma instância. Para escalar horizontalmente: Redis pub/sub (ou Supabase Realtime) — não instalar duas soluções ao mesmo tempo.

## D-013 — Sessão por cookie HttpOnly com token opaco

- **Decisão:** senha com scrypt (stdlib, N=2^17) + salt por usuário; sessão = token aleatório em cookie `HttpOnly; SameSite=Lax` (`Secure` em produção); o banco guarda só o SHA-256 do token. Logout apaga a sessão no servidor. Limite de 8 tentativas de login por IP+e-mail a cada 5 min (em memória).
- **Dev:** o Vite faz proxy de `/api` (HTTP e WebSocket) para a API — mesma origem, sem CORS para o navegador.

## D-014 — Contas de demonstração identificadas

- **Decisão:** `uv run python -m app.seed` cria as 3 pessoas do MVP como `is_demo=True` (senha aleatória não exibida — não servem para login). A interface sempre mostra o selo "demo"; os números da comunidade informam quantos membros são demo. Usuários fictícios nunca aparecem "online".

## D-015 — Identidade visual "Sala escura"

- **Decisão:** substitui o tema branco/rosa do MVP por interface escura com acento violeta (`--iris`) e âmbar de projetor (`--lamp`); Bricolage Grotesque + Inter Tight + Instrument Serif servidas via `@fontsource` (sem CDN). GSAP + ScrollTrigger para animações. Detalhes em `EUNIS_REDESIGN_PLAN.md` §B.
