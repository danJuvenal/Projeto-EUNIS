import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '../src/App'
import { AuthProvider } from '../src/context/auth'

type Handler = (url: string, init?: RequestInit) => unknown

/** Mock de fetch por rota. Retorna 404 para o que não estiver mapeado. */
export function mockApi(map: Record<string, unknown | Handler>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const key = Object.keys(map)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.startsWith(k))
    if (!key) return new Response(JSON.stringify({ detail: 'não mapeado' }), { status: 404 })
    const v = map[key]
    const body = typeof v === 'function' ? (v as Handler)(url, init) : v
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

export const TITLE = {
  id: 1,
  source: 'demo',
  media_type: 'movie',
  title: 'Parasita',
  year: 2019,
  poster_url: null,
  backdrop_url: null,
  palette: ['#3E2C5A', '#0E7C6B'],
  genres: [{ slug: 'drama', name: 'Drama' }],
  tmdb_rating: null,
  overview: 'Uma família sem trabalho se infiltra na casa de uma família rica.',
  community: { count: 0, avg: null },
}
