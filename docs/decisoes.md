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
