# EUNIS — CLAUDE.md

> Documento central de contexto, arquitetura, regras e roadmap do projeto EUNIS.
>
> **Regra principal:** antes de alterar qualquer código, leia este arquivo inteiro e analise o estado atual do projeto. Não implemente funcionalidades fora do escopo ou da tarefa atual sem autorização.

---

# 1. VISÃO DO PRODUTO

## 1.1 Nome

**EUNIS**

## 1.2 Conceito

EUNIS é uma plataforma de descoberta, busca e organização de filmes e séries.

A proposta é permitir que o usuário descubra conteúdo de forma tradicional e também através de **busca por intenção em linguagem natural**, além de avaliações, comentários, listas e recomendações personalizadas.

Exemplo:

> "Quero um filme de terror psicológico, sem muito jumpscare, com menos de duas horas."

O sistema deverá interpretar a intenção e retornar conteúdos compatíveis.

---

# 2. OBJETIVO DO PROJETO

Transformar o MVP/protótipo atual em uma aplicação web real, modular, segura, escalável e preparada para produção.

O projeto deve evoluir de:

```text
MVP local em HTML/CSS/JavaScript
        ↓
Frontend estruturado
        ↓
Backend real
        ↓
Banco de dados real
        ↓
Integrações externas
        ↓
Aplicação multiusuário
        ↓
Produção
```

---

# 3. ESTADO ATUAL DO PROJETO

O projeto possui atualmente um protótipo navegável chamado:

```text
eunis.html
```

O protótipo concentra grande parte da aplicação em um único arquivo e utiliza armazenamento local do navegador.

O MVP já demonstra diversas funcionalidades e fluxos de interface, mas muitas delas ainda são simuladas/local-only.

## 3.1 Funcionalidades já presentes no protótipo

- Cadastro
- Login
- Logout
- Sessão local
- Recuperação de senha simulada
- Onboarding
- Seleção de gêneros favoritos
- Home
- Conteúdos em alta
- Recomendações
- Busca por intenção
- Busca textual
- Filtros
- Página de detalhes
- Avaliações
- Resenhas
- Comentários
- Curtidas
- Listas
- Listas públicas
- Listas privadas
- Itens salvos
- Perfil
- Configurações
- Preferências de usuário
- Tema claro/escuro/sistema
- Filtro de palavrões
- Plano Premium simulado
- Métricas/eventos
- Navegação entre diferentes telas/rotas

## 3.2 Estado real dessas funcionalidades

Grande parte ainda é:

```text
protótipo / demonstração
```

e não:

```text
produção / backend real
```

Portanto, **não assumir que uma funcionalidade visual já está implementada de forma definitiva**.

---

# 4. PRINCIPAL OBJETIVO TÉCNICO

A prioridade é separar o protótipo em uma arquitetura profissional.

O projeto não deve permanecer como um único arquivo gigante contendo:

- HTML
- CSS
- JavaScript
- banco local
- regras de negócio
- autenticação
- dados de catálogo
- navegação
- componentes

A aplicação deverá evoluir para módulos independentes.

---

# 5. ARQUITETURA ALVO

Arquitetura conceitual:

```text
                    EUNIS
                      │
              ┌───────┴───────┐
              │               │
          FRONTEND         BACKEND
              │               │
          Interface       API / Regras
              │               │
              └───────┬───────┘
                      │
                 PostgreSQL
                      │
        ┌─────────────┼─────────────┐
        │             │             │
       TMDb           IA        Pagamentos
```

## 5.1 Camadas

### Frontend

Responsável por:

- interface
- navegação
- componentes
- estados
- formulários
- feedback visual
- chamadas à API
- autenticação no cliente
- experiência do usuário

### Backend

Responsável por:

- autenticação
- autorização
- regras de negócio
- acesso ao banco
- integração com TMDb
- integração com IA
- avaliações
- comentários
- listas
- métricas
- pagamentos
- validações
- segurança

### Banco de dados

Responsável pela persistência definitiva dos dados.

---

# 6. STACK

A stack deve ser definida e documentada antes da implementação estrutural.

Direção preferencial:

## Frontend

```text
React
```

## Backend

```text
Python
FastAPI
```

## Banco

```text
PostgreSQL
```

## Versionamento

```text
Git
GitHub
```

## Testes

Backend:

```text
pytest
```

Frontend:

```text
framework de testes adequado à stack escolhida
```

> Se a stack precisar ser alterada, justificar a decisão antes de realizar uma migração grande.

---

# 7. ESTRUTURA DE PASTAS ALVO

Estrutura inicial desejada:

```text
Aplicativo_filmes/
│
├── frontend/
│   └── tests/        ← testes do frontend
│
├── backend/
│   └── tests/        ← testes do backend
│
├── database/
│
├── docs/
│   └── legacy/       ← definições .d.ts do runtime de Artifacts (referência)
│
├── scripts/
│
├── legacy/           ← MVP original (eunis.html), sem alterações
│
├── .env              ← local, nunca commitado
├── .env.example
├── .gitattributes
├── .gitignore
├── README.md
└── CLAUDE.md
```

**Testes:** ficam separados por projeto, em `backend/tests/` e `frontend/tests/`. Não utilizar uma pasta `tests/` na raiz como estrutura principal (decisão D-003 em `docs/decisoes.md`).

A estrutura interna de cada pasta deve ser definida durante a implementação.

Não criar dezenas de pastas vazias sem necessidade.

---

# 8. BANCO DE DADOS

O armazenamento local utilizado pelo protótipo não deve ser tratado como banco de produção.

O sistema deverá migrar para banco relacional.

## 8.1 Entidades iniciais

### users

Campos esperados:

```text
id
name
email
password_hash
bio
plan
created_at
updated_at
```

### user_preferences

```text
id
user_id
theme
profanity_filter
notifications
created_at
updated_at
```

### genres

```text
id
name
```

### movies

```text
id
tmdb_id
title
overview
release_date
runtime
poster_path
backdrop_path
created_at
updated_at
```

### movie_genres

```text
movie_id
genre_id
```

### ratings

```text
id
user_id
movie_id
rating
review
created_at
updated_at
```

### comments

```text
id
user_id
movie_id
content
created_at
updated_at
```

### lists

```text
id
user_id
name
description
is_public
created_at
updated_at
```

### list_items

```text
id
list_id
movie_id
created_at
```

### events / analytics

```text
id
user_id
event_name
metadata
created_at
```

> O schema definitivo deve ser criado através de migrations e revisado antes de ser considerado estável.

---

# 9. RELACIONAMENTOS IMPORTANTES

```text
User
 ├── Preferences
 ├── Ratings
 ├── Comments
 ├── Lists
 └── Events

Movie
 ├── Genres
 ├── Ratings
 ├── Comments
 └── Lists

List
 └── ListItems
       └── Movie
```

---

# 10. AUTENTICAÇÃO

A autenticação atual do protótipo é local/simulada.

A versão real deve implementar:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/forgot-password
POST /auth/reset-password
```

## Requisitos

- senha armazenada somente como hash
- nunca armazenar senha em texto puro
- validação de e-mail
- sessão/token seguro
- autorização por usuário
- proteção contra abuso
- recuperação real de senha
- tratamento adequado de erros

O frontend nunca deve conter secrets.

---

# 11. AUTORIZAÇÃO

Usuários só podem alterar recursos que possuem permissão para alterar.

Exemplos:

```text
Usuário A NÃO pode editar avaliação do Usuário B.

Usuário A NÃO pode excluir comentário do Usuário B,
exceto se existir uma regra explícita de moderação.

Usuário A NÃO pode modificar lista privada do Usuário B.

Usuário A NÃO pode acessar dados privados de outro usuário.
```

Toda autorização deve ser validada no backend.

Nunca confiar apenas no frontend.

---

# 12. CATÁLOGO DE FILMES E SÉRIES

O protótipo possui um catálogo local/demonstrativo.

Esse catálogo não deve ser tratado como fonte definitiva.

A aplicação real deverá integrar uma API de catálogo, com direção inicial para:

```text
TMDb
```

## Funcionalidades necessárias

- busca
- detalhes
- tendências
- gêneros
- recomendações
- imagens
- informações de filmes
- informações de séries
- disponibilidade quando suportada pela fonte

---

# 13. CACHE E DADOS EXTERNOS

Não consultar APIs externas desnecessariamente.

Sempre que apropriado:

```text
Usuário
 ↓
Backend
 ↓
Cache / Banco
 ↓
API externa somente quando necessário
```

Segredos e API keys devem permanecer no backend.

Nunca expor chaves privadas no frontend.

---

# 14. API DE FILMES

Endpoints conceituais:

```text
GET /movies/search
GET /movies/{id}
GET /movies/trending
GET /movies/popular
GET /genres
GET /movies/{id}/recommendations
```

A nomenclatura final pode ser ajustada conforme a arquitetura.

---

# 15. BUSCA TRADICIONAL

A busca deverá aceitar:

- título
- filme
- série
- gênero
- ano
- tema
- plataforma
- nota mínima
- duração

Filtros devem ser processados pelo backend quando envolverem dados do banco/API.

---

# 16. BUSCA POR IA

Essa é uma funcionalidade central do EUNIS.

Exemplo:

```text
"Quero um filme de terror psicológico sem muito jumpscare e
com menos de duas horas."
```

Fluxo desejado:

```text
Usuário
   ↓
Frontend
   ↓
Backend
   ↓
LLM
   ↓
Interpretação estruturada
   ↓
Filtros / candidatos
   ↓
Banco + TMDb
   ↓
Ranking
   ↓
Resultados
```

A IA deve preferencialmente retornar uma estrutura controlada.

Exemplo:

```json
{
  "type": "movie",
  "genres": ["Horror"],
  "runtime_max": 120,
  "keywords": [
    "psychological horror",
    "low jumpscare"
  ]
}
```

A IA não deve ser usada como fonte única de dados factuais do catálogo.

---

# 17. FALLBACK DA BUSCA IA

Se a IA falhar:

```text
Busca IA
   ↓
falha
   ↓
fallback
   ↓
busca tradicional
```

O usuário não deve receber uma tela quebrada simplesmente porque o serviço de IA está indisponível.

---

# 18. RECOMENDAÇÕES

O sistema deve futuramente utilizar sinais como:

- gêneros favoritos
- avaliações
- histórico
- conteúdos salvos
- listas
- comportamento de busca

A primeira versão pode usar regras simples.

Não começar com um sistema complexo de machine learning sem necessidade.

---

# 19. AVALIAÇÕES

O sistema deve permitir:

```text
Criar avaliação
Editar avaliação
Excluir avaliação
Consultar avaliação
```

Regras:

- nota controlada por intervalo definido
- usuário autenticado
- uma avaliação por usuário/conteúdo, salvo regra futura diferente
- backend valida tudo
- média calculada corretamente

Também devem existir:

```text
média
quantidade de avaliações
distribuição das notas
```

---

# 20. COMENTÁRIOS

Funcionalidades:

```text
Criar
Listar
Editar
Excluir
Curtir
```

Futuramente:

```text
Denunciar
Moderar
Bloquear
```

Nunca confiar em validações apenas no frontend.

---

# 21. LISTAS

Usuários poderão criar listas.

Cada lista possui:

```text
nome
descrição
visibilidade
itens
proprietário
```

Endpoints conceituais:

```text
POST   /lists
GET    /lists/me
GET    /lists/{id}
PATCH  /lists/{id}
DELETE /lists/{id}

POST   /lists/{id}/items
DELETE /lists/{id}/items/{movie_id}
```

---

# 22. PERFIL

O perfil deverá apresentar, conforme as permissões:

- nome
- bio
- plano
- avaliações
- listas
- comentários
- estatísticas

Dados privados não devem ser expostos indevidamente.

---

# 23. CONFIGURAÇÕES

O usuário poderá configurar:

- nome
- bio
- gêneros favoritos
- filtro de palavrões
- notificações
- tema
- plano
- exportação de dados
- exclusão de dados

A exclusão de dados deve exigir confirmação e ser tratada cuidadosamente no backend.

---

# 24. PREMIUM

O Premium atualmente é simulado.

Não considerar:

```text
u.plano = "premium"
```

como implementação real de assinatura.

Futuro fluxo:

```text
Usuário
 ↓
Checkout
 ↓
Pagamento
 ↓
Webhook
 ↓
Backend
 ↓
Subscription
 ↓
Usuário Premium
```

O provedor de pagamento será decidido antes da implementação.

Não implementar pagamentos reais sem definição explícita.

---

# 25. ANALYTICS

O protótipo já possui conceito de eventos.

Eventos relevantes incluem:

```text
user_registered
user_logged_in
search_performed
ai_search
movie_opened
rating_created
comment_created
list_created
movie_saved
premium_started
```

A implementação real deve enviar eventos para o backend ou serviço apropriado.

Não registrar informações sensíveis desnecessárias.

---

# 26. INTERFACE E UX

O protótipo atual deve ser tratado como referência visual e funcional.

Antes de remover ou redesenhar uma tela existente:

1. analisar o comportamento atual;
2. preservar funcionalidades importantes;
3. identificar dependências;
4. migrar gradualmente;
5. testar;
6. somente então remover o legado.

Não destruir o MVP antes de existir uma substituição funcional.

---

# 27. MIGRAÇÃO DO MVP

A migração deve ocorrer progressivamente.

Estratégia:

```text
MVP atual
   ↓
separar estrutura
   ↓
criar frontend
   ↓
criar backend
   ↓
criar banco
   ↓
implementar API
   ↓
migrar funcionalidades
   ↓
testar
   ↓
remover dependências locais
```

Não tentar reescrever todo o sistema em um único passo.

---

# 28. TESTES

Testes devem ser adicionados conforme as funcionalidades são implementadas.

## Backend

Testar pelo menos:

- cadastro
- login
- autenticação
- autorização
- busca
- filmes
- avaliações
- comentários
- listas
- preferências

## Frontend

Testar fluxos críticos:

```text
Cadastro
Login
Busca
Abrir filme
Avaliar
Comentar
Criar lista
Salvar conteúdo
Perfil
Configurações
```

## Segurança

Testar:

- acesso indevido
- alteração de recursos de terceiros
- dados privados
- inputs inválidos
- autenticação ausente
- tokens inválidos

---

# 29. TRATAMENTO DE ERROS

Nenhuma integração externa deve derrubar toda a aplicação.

Serviços externos podem falhar.

Implementar:

```text
loading
empty state
error state
retry quando apropriado
fallback
```

Mensagens para usuários devem ser claras.

Logs técnicos devem ficar no backend.

Não expor stack traces ao usuário.

---

# 30. SEGURANÇA

Nunca:

- colocar API keys no frontend;
- colocar secrets no Git;
- armazenar senha em texto puro;
- confiar em autorização do frontend;
- retornar dados privados desnecessários;
- executar SQL inseguro;
- inserir HTML não sanitizado vindo do usuário;
- ignorar validação de entrada.

Utilizar:

```text
.env
.env.example
.gitignore
```

Secrets nunca devem ser commitados.

---

# 31. VARIÁVEIS DE AMBIENTE

Criar:

```text
.env
.env.example
```

Exemplos conceituais:

```text
DATABASE_URL=
TMDB_API_KEY=
AI_API_KEY=
SECRET_KEY=
PAYMENT_API_KEY=
```

Os nomes reais devem ser definidos conforme a implementação.

`.env` não deve entrar no Git.

---

# 32. GIT

Usar Git desde o início da migração.

Commits devem representar mudanças lógicas.

Exemplos:

```text
feat: add authentication API
feat: add movie search endpoint
feat: add ratings
fix: validate list ownership
refactor: split frontend components
test: add authentication tests
docs: update architecture
```

Evitar commits gigantes contendo centenas de alterações sem relação.

---

# 33. DOCUMENTAÇÃO

Manter:

```text
README.md
docs/
CLAUDE.md
```

Documentar:

- instalação
- configuração
- banco
- migrations
- execução
- testes
- variáveis de ambiente
- arquitetura
- APIs
- decisões técnicas importantes

---

# 34. REGRAS PARA O CLAUDE

## Regra 1 — Ler antes de alterar

Sempre ler:

```text
CLAUDE.md
```

antes de começar uma tarefa.

## Regra 2 — Inspecionar o projeto real

Nunca assumir que arquivos, classes, endpoints ou componentes existem.

Antes de editar:

```text
listar
localizar
ler
entender
alterar
testar
```

## Regra 3 — Não inventar arquitetura existente

Se algo não existe, dizer que não existe.

## Regra 4 — Não apagar código sem necessidade

Antes de remover algo:

- verificar dependências;
- procurar referências;
- explicar o impacto;
- substituir por funcionalidade equivalente quando necessário.

## Regra 5 — Trabalhar em pequenas etapas

Cada tarefa deve ser pequena o suficiente para:

```text
implementar
testar
corrigir
documentar
```

## Regra 6 — Não implementar funcionalidades fora da tarefa

Se encontrar melhorias futuras:

```text
anotar
```

mas não implementar automaticamente.

## Regra 7 — Preservar funcionalidades existentes

Ao migrar o MVP, não remover comportamentos sem substituição.

## Regra 8 — Testar depois das alterações

Sempre executar os testes relevantes.

Se não houver testes, informar.

## Regra 9 — Não esconder erros

Se algo falhar:

```text
explicar
identificar causa
corrigir
testar novamente
```

Não mascarar erros apenas para fazer o comando terminar.

## Regra 10 — Segurança primeiro

Nunca implementar atalhos inseguros para autenticação, autorização ou armazenamento de secrets.

---

# 35. ORDEM OFICIAL DE IMPLEMENTAÇÃO

A ordem inicial do projeto é:

```text
FASE 0 — Análise e planejamento
FASE 1 — Estrutura profissional do projeto
FASE 2 — Definição da stack
FASE 3 — Banco PostgreSQL + migrations
FASE 4 — Backend FastAPI
FASE 5 — Autenticação
FASE 6 — Integração TMDb
FASE 7 — Migração do catálogo/Home
FASE 8 — Busca tradicional
FASE 9 — Busca por IA
FASE 10 — Página de conteúdo
FASE 11 — Avaliações
FASE 12 — Comentários
FASE 13 — Listas
FASE 14 — Perfil e configurações
FASE 15 — Recomendações
FASE 16 — Analytics
FASE 17 — Premium/pagamentos
FASE 18 — Testes completos
FASE 19 — Segurança e hardening
FASE 20 — Deploy
FASE 21 — Documentação final
```

---

# 36. CRITÉRIO DE CONCLUSÃO DE CADA FASE

Uma fase não é considerada concluída apenas porque o código foi escrito.

Para considerar uma fase concluída:

```text
[ ] implementação
[ ] integração
[ ] validação
[ ] testes
[ ] correções
[ ] documentação
[ ] revisão
```

---

# 37. ROADMAP DETALHADO

## FASE 0 — Análise ✅ CONCLUÍDA (2026-10-02)

Objetivo:

Entender completamente o MVP atual.

Tarefas:

- [x] analisar eunis.html
- [x] mapear telas
- [x] mapear funcionalidades
- [x] mapear dados
- [x] mapear dependências
- [x] identificar código legado
- [x] documentar arquitetura atual

Resultado: `docs/analise-fase0.md`.

---

## FASE 1 — Estrutura ✅ CONCLUÍDA (2026-10-02)

- [x] criar frontend
- [x] criar backend
- [x] criar database
- [x] criar tests (em `backend/tests/` e `frontend/tests/`)
- [x] criar docs
- [x] configurar Git
- [x] configurar .gitignore
- [x] criar .env.example
- [x] preservar MVP em `legacy/` e `.d.ts` em `docs/legacy/`

---

## FASE 2 — Stack 🟡 AGUARDANDO REVISÃO (2026-10-02)

- [x] definir framework frontend (React + Vite + TypeScript, Vitest + Testing Library)
- [x] configurar backend (Python 3.12 + FastAPI, uv, pytest)
- [~] configurar PostgreSQL (`docker-compose.yml` criado; Docker Desktop ainda não instalado, não executado)
- [x] configurar ambiente local
- [x] documentar decisões (D-006 a D-008 em `docs/decisoes.md`)

---

## FASE 3 — Banco

- [ ] modelar entidades
- [ ] criar migrations
- [ ] criar relacionamentos
- [ ] criar índices necessários
- [ ] criar constraints
- [ ] testar CRUD básico

---

## FASE 4 — Backend

- [ ] criar aplicação FastAPI
- [ ] configurar rotas
- [ ] configurar serviços
- [ ] configurar acesso ao banco
- [ ] configurar tratamento de erros
- [ ] configurar documentação OpenAPI

---

## FASE 5 — Auth

- [ ] cadastro
- [ ] login
- [ ] logout
- [ ] sessão
- [ ] /me
- [ ] recuperação
- [ ] autorização
- [ ] testes

---

## FASE 6 — TMDb

- [ ] configurar API key
- [ ] criar cliente
- [ ] busca
- [ ] detalhes
- [ ] tendências
- [ ] gêneros
- [ ] recomendações
- [ ] cache
- [ ] tratamento de erros

---

## FASE 7 — Home

- [ ] migrar conteúdo em alta
- [ ] migrar recomendações
- [ ] migrar categorias
- [ ] migrar conteúdo brasileiro
- [ ] migrar séries
- [ ] migrar listas

---

## FASE 8 — Busca

- [ ] busca textual
- [ ] filtros
- [ ] paginação
- [ ] ordenação
- [ ] estados vazios
- [ ] loading
- [ ] erros

---

## FASE 9 — IA

- [ ] definir provider
- [ ] criar serviço de IA
- [ ] interpretar intenção
- [ ] gerar filtros estruturados
- [ ] integrar catálogo
- [ ] ranking
- [ ] fallback
- [ ] limites de uso

---

## FASE 10 — Conteúdo

- [ ] detalhes
- [ ] disponibilidade
- [ ] gêneros
- [ ] temas
- [ ] recomendações
- [ ] avaliações
- [ ] comentários
- [ ] salvar

---

## FASE 11 — Avaliações

- [ ] criar
- [ ] editar
- [ ] excluir
- [ ] média
- [ ] distribuição
- [ ] validações
- [ ] testes

---

## FASE 12 — Comunidade

- [ ] comentários
- [ ] curtidas
- [ ] denúncias
- [ ] moderação básica
- [ ] filtro
- [ ] autorização

---

## FASE 13 — Listas

- [ ] criar
- [ ] editar
- [ ] excluir
- [ ] adicionar filme
- [ ] remover filme
- [ ] público/privado
- [ ] visualizar
- [ ] compartilhar

---

## FASE 14 — Perfil

- [ ] perfil
- [ ] edição
- [ ] preferências
- [ ] histórico
- [ ] listas
- [ ] avaliações
- [ ] configurações

---

## FASE 15 — Recomendações

Começar simples.

Utilizar:

```text
gêneros favoritos
+
avaliações
+
listas
+
histórico
```

Evoluir posteriormente.

---

## FASE 16 — Analytics

- [ ] eventos
- [ ] armazenamento
- [ ] métricas
- [ ] dashboard administrativo futuramente

---

## FASE 17 — Premium

Somente após o núcleo estar estável.

- [ ] definir planos
- [ ] definir benefícios
- [ ] escolher gateway
- [ ] checkout
- [ ] webhook
- [ ] assinatura
- [ ] cancelamento
- [ ] controle de acesso

---

## FASE 18 — Testes

- [ ] testes unitários
- [ ] testes de integração
- [ ] testes de API
- [ ] testes frontend
- [ ] testes de autenticação
- [ ] testes de autorização
- [ ] testes de fluxos críticos

---

## FASE 19 — Segurança

- [ ] secrets
- [ ] CORS
- [ ] rate limiting
- [ ] validação
- [ ] sanitização
- [ ] autorização
- [ ] logs
- [ ] proteção de endpoints
- [ ] revisão de dependências

---

## FASE 20 — Deploy

Definir:

```text
Frontend
Backend
Banco
Domínio
HTTPS
Variáveis de ambiente
Logs
Monitoramento
Backup
```

---

## FASE 21 — Documentação

- [ ] README
- [ ] arquitetura
- [ ] banco
- [ ] API
- [ ] setup
- [ ] deploy
- [ ] troubleshooting
- [ ] decisões técnicas

---

# 38. DEFINIÇÃO DE PRONTO

Uma funcionalidade só deve ser considerada pronta quando:

```text
[✓] código implementado
[✓] backend funcionando
[✓] frontend integrado
[✓] banco persistindo corretamente
[✓] validações implementadas
[✓] autorização implementada
[✓] tratamento de erro implementado
[✓] testes executados
[✓] documentação atualizada
```

---

# 39. O QUE NÃO FAZER AGORA

Não implementar ainda sem autorização específica:

- pagamento real
- infraestrutura de produção definitiva
- sistema avançado de machine learning
- microserviços
- Kubernetes
- arquitetura distribuída complexa
- recursos sociais avançados
- funcionalidades não descritas no roadmap

O objetivo é construir uma aplicação sólida antes de adicionar complexidade.

---

# 40. PRINCÍPIO DE DESENVOLVIMENTO

Preferir:

```text
simples
modular
testável
documentado
seguro
```

em vez de:

```text
complexo
rápido
acoplado
difícil de testar
```

---

# 41. FORMATO DE TRABALHO DO CLAUDE

Para cada tarefa:

## Antes

1. Ler CLAUDE.md.
2. Ler os arquivos relacionados.
3. Identificar dependências.
4. Explicar brevemente o que será alterado.
5. Implementar somente a tarefa atual.

## Durante

- manter mudanças pequenas;
- reutilizar código existente quando adequado;
- evitar duplicação;
- respeitar arquitetura;
- não criar abstrações desnecessárias.

## Depois

1. Rodar testes.
2. Corrigir erros.
3. Verificar regressões.
4. Atualizar documentação quando necessário.
5. Informar exatamente o que foi alterado.

---

# 42. COMUNICAÇÃO COM O USUÁRIO

Quando uma tarefa terminar, informar:

```text
O que foi feito
Arquivos alterados
Testes executados
Resultado dos testes
Problemas encontrados
Próximo passo sugerido
```

Não afirmar que algo funciona sem testar.

---

# 43. TAREFA ATUAL

## REBOOT DO EUNIS (2026-10-15) — implementado, aguardando revisão

O dono do produto autorizou um "reboot": redesign completo, landing page cinematográfica e
funcionalidades sociais reais. Isso entregou, de uma vez, partes das Fases 3, 4, 5, 6, 7, 8, 10–15:

- Banco (SQLAlchemy + Alembic; SQLite local, PostgreSQL via `DATABASE_URL`) — D-009
- Auth real (scrypt + cookie HttpOnly) — D-013
- Catálogo TMDb com fallback demo — D-010
- Críticas (CRUD, curtidas, comentários), biblioteca, listas, seguir, feed, perfis
- Presença online em tempo real (WebSocket) — D-012
- Match cinematográfico e compatibilidade entre usuários
- Nova identidade visual + GSAP — D-015

Documentos: `EUNIS_REDESIGN_PLAN.md` (plano e direção visual) e `docs/decisoes.md` (D-009 a D-015).

### Pendências conhecidas

- D-011: confirmar se as regras Premium (D-002) valem no lançamento (`PREMIUM_ENFORCEMENT`).
- Instalar Docker e validar com PostgreSQL (D-008).
- Configurar `TMDB_API_KEY` e validar o modo TMDb com a API real (testado só com HTTP simulado).
- Fora do escopo do reboot: busca por IA (Fase 9), recuperação de senha por e-mail, pagamentos,
  moderação/denúncias, analytics (Fase 16), presença multi-instância.

Próximas tarefas devem voltar ao formato incremental desta CLAUDE.md (§41).

---

# 44. REGRA ABSOLUTA

> **Não sair da tarefa atual.**
>
> Se houver dúvida sobre uma decisão arquitetural importante, parar e perguntar antes de implementar.
>
> O objetivo é construir o EUNIS de forma incremental, verificável e profissional.
