import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PosterArt } from '../src/components/Poster'
import { StarInput } from '../src/components/Rating'
import { runtime, stars } from '../src/lib/format'
import { mockApi, renderRoute, TITLE } from './helpers'

const EMPTY = {
  '/api/auth/me': { user: null },
  '/api/catalog/status': { source: 'demo' },
  '/api/genres': [
    { slug: 'drama', name: 'Drama' },
    { slug: 'terror', name: 'Terror' },
  ],
  '/api/titles/trending': { source: 'demo', results: [TITLE] },
  '/api/titles': { source: 'demo', page: 1, total_pages: 1, results: [TITLE] },
  '/api/reviews': { results: [] },
  '/api/lists': { results: [] },
  '/api/community/activity': { results: [] },
  '/api/community/stats': { members: 3, demo_members: 3, reviews: 0, online: 0 },
}

describe('Landing', () => {
  it('mostra o hero, CTAs reais e dados do catálogo', async () => {
    mockApi(EMPTY)
    renderRoute('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Seu próximo\s*filme favorito\s*está esperando/)
    expect(screen.getByRole('link', { name: /Explorar o catálogo/ })).toHaveAttribute('href', '/explorar')
    expect(screen.getAllByRole('link', { name: /Criar conta/ })[0]).toHaveAttribute('href', '/cadastro')
    // selo honesto do catálogo demo
    expect(await screen.findAllByText('Catálogo demo')).not.toHaveLength(0)
    // card de destaque vem da API
    expect(await screen.findByRole('heading', { name: 'Parasita' })).toBeInTheDocument()
  })

  it('não inventa usuários online nem atividade', async () => {
    mockApi(EMPTY)
    renderRoute('/')
    const online = document.getElementById('online')!
    expect(await within(online).findByText(/Conectando à presença|Ninguém online/)).toBeInTheDocument()
    expect(await within(online).findByText('Sem atividade registrada ainda.')).toBeInTheDocument()
  })
})

describe('Cadastro', () => {
  it('valida no cliente antes de enviar', async () => {
    const fetchMock = mockApi(EMPTY)
    renderRoute('/cadastro')
    fireEvent.click(await screen.findByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/auth/register'))).toBe(false)
  })

  it('mostra o erro do servidor (e-mail duplicado)', async () => {
    mockApi({
      ...EMPTY,
      '/api/auth/register': () =>
        new Response(JSON.stringify({ detail: 'Esse e-mail já tem conta. Entre em vez de criar.' }), { status: 409 }),
    })
    renderRoute('/cadastro')
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Nome de usuário (@)'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@test.dev' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse e-mail já tem conta')
  })
})

describe('Rotas protegidas', () => {
  it('feed sem login redireciona para entrar', async () => {
    mockApi(EMPTY)
    renderRoute('/feed')
    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta' })).toBeInTheDocument()
  })
})

describe('Explorar', () => {
  it('busca pela API e mostra estado vazio honesto', async () => {
    const fetchMock = mockApi({
      ...EMPTY,
      '/api/titles': (url: string) =>
        url.includes('q=xyz') ? { source: 'demo', page: 1, total_pages: 1, results: [] } : { source: 'demo', page: 1, total_pages: 1, results: [TITLE] },
    })
    renderRoute('/explorar?q=xyz')
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument()
    expect(screen.getByText(/catálogo demo tem apenas 32 títulos/)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/titles?q=xyz'))).toBe(true))
  })
})

describe('Componentes', () => {
  it('arte tipográfica usa o título real quando não há pôster', () => {
    render(<PosterArt title={{ ...TITLE, media_type: 'tv' }} />)
    expect(screen.getByRole('img', { name: 'Arte tipográfica de Parasita' })).toHaveTextContent('Parasita')
    expect(screen.getByText('Série')).toBeInTheDocument()
  })

  it('nota em meias estrelas responde ao teclado', () => {
    let value: number | null = 6
    const { rerender } = render(<StarInput value={value} onChange={(v) => (value = v)} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(value).toBe(7)
    rerender(<StarInput value={1} onChange={(v) => (value = v)} />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' })
    expect(value).toBeNull()
  })

  it('formatações', () => {
    expect(stars(9)).toBe('4,5')
    expect(runtime(132, null)).toBe('2h12')
    expect(runtime(null, 1)).toBe('1 temporada')
  })
})
