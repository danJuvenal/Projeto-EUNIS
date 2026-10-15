# frontend/

Interface web do EUNIS — **React 19 + Vite + TypeScript + React Router + GSAP (ScrollTrigger)**, testes com **Vitest + Testing Library**.

## Estrutura

```text
frontend/src/
├── App.tsx               # rotas (lazy por página)
├── main.tsx              # fontes + estilos
├── styles/               # tokens.css, base.css, components.css, landing.css, pages.css
├── lib/                  # api, hooks, motion (GSAP), format, catalog, useLibrary, types
├── context/              # auth, presence (WebSocket), toast
├── components/           # Navbar, AppShell, Poster, TitleCard, ReviewCard, Rating, Modal…
└── pages/                # Landing, Explore, TitleDetail, Auth, Social, Profile, ListPage, Match, Settings, Static
```

## Comandos (dentro de `frontend/`, Node 24)

```bash
npm install
npm run dev           # http://localhost:5173 — /api é encaminhado para http://127.0.0.1:8000 (inclui WebSocket)
npm test              # Vitest
npm run lint          # oxlint
npm run build         # tsc + build de produção em dist/
```

## Regras

- Nenhum segredo no frontend. Sessão via cookie HttpOnly (mesma origem graças ao proxy do Vite).
- Animações: sempre via `useGsap` (gsap.matchMedia + revert no unmount); `prefers-reduced-motion` desliga movimento.
- Dados ausentes viram estados vazios honestos — nada de números ou usuários inventados.
- Em produção, servir frontend e API na mesma origem (ou ajustar `VITE_API_BASE`, CORS e cookie `Secure`).
