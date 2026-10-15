import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorState, EmptyState, SourceBadge } from '../components/States'
import { TitleCard, TitleCardSkeleton } from '../components/TitleCard'
import { Icon } from '../components/Icon'
import { api, qs } from '../lib/api'
import { useGenres } from '../lib/catalog'
import { useDebounced, useDocumentTitle } from '../lib/hooks'
import { gsap, useGsap } from '../lib/motion'
import type { Paged, TitleSummary } from '../lib/types'

const SORTS = [
  { v: 'popular', l: 'Mais populares' },
  { v: 'rating', l: 'Melhor avaliados' },
  { v: 'recent', l: 'Mais recentes' },
  { v: 'title', l: 'A–Z' },
]

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const genres = useGenres()
  const q = params.get('q') ?? ''
  const type = params.get('tipo') ?? ''
  const genre = params.get('genero') ?? ''
  const sort = params.get('ordem') ?? 'popular'
  const [text, setText] = useState(q)
  const debounced = useDebounced(text, 350)
  const [items, setItems] = useState<TitleSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [source, setSource] = useState<'demo' | 'tmdb'>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const grid = useRef<HTMLDivElement>(null)

  useDocumentTitle(type === 'tv' ? 'Séries' : type === 'movie' ? 'Filmes' : 'Explorar')

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  // busca digitada → URL (debounce)
  useEffect(() => {
    if (debounced !== q) set('q', debounced.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  useEffect(() => setText(q), [q])

  // Mudou filtro → primeira página
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api<Paged<TitleSummary>>(`/api/titles${qs({ q, type, genre, sort, page: 1 })}`, { signal: ctrl.signal })
      .then((r) => {
        setItems(r.results)
        setPage(1)
        setTotalPages(r.total_pages ?? 1)
        setSource(r.source)
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e))
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [q, type, genre, sort, nonce])

  const more = async () => {
    setLoading(true)
    try {
      const r = await api<Paged<TitleSummary>>(`/api/titles${qs({ q, type, genre, sort, page: page + 1 })}`)
      setItems((cur) => {
        const ids = new Set(cur.map((t) => t.id))
        return [...cur, ...r.results.filter((t) => !ids.has(t.id))]
      })
      setPage(page + 1)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }

  // Resultados novos entram suavemente
  useGsap(
    ({ motion }) => {
      if (!motion || loading || !items.length) return
      gsap.from('.title-card', { autoAlpha: 0, y: 16, stagger: 0.025, duration: 0.55, clearProps: 'all' })
    },
    [q, type, genre, sort, loading && page === 1],
    grid,
  )

  const heading = q ? `Resultados para “${q}”` : type === 'tv' ? 'Séries' : type === 'movie' ? 'Filmes' : 'Explorar'

  return (
    <div className="container page">
      <header className="page__head explore__head">
        <div>
          <p className="eyebrow">
            Catálogo <SourceBadge source={source} />
          </p>
          <h1 className="page__title">{heading}</h1>
        </div>
        <form className="explore__search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" size={20} />
          <label htmlFor="explore-q" className="sr-only">
            Buscar por título, diretor, tema ou gênero
          </label>
          <input
            id="explore-q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Título, direção, tema…"
            autoComplete="off"
          />
          {text && (
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Limpar busca" onClick={() => setText('')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </form>
      </header>

      <div className="filters">
        <div className="segmented" role="radiogroup" aria-label="Tipo">
          {[
            ['', 'Tudo'],
            ['movie', 'Filmes'],
            ['tv', 'Séries'],
          ].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={type === v} className={type === v ? 'is-active' : ''} onClick={() => set('tipo', v)}>
              {l}
            </button>
          ))}
        </div>
        <label className="select">
          <span className="sr-only">Ordenar</span>
          <select value={sort} onChange={(e) => set('ordem', e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chips-row" role="group" aria-label="Gêneros">
        <button className={`chip ${!genre ? 'is-active' : ''}`} onClick={() => set('genero', '')} aria-pressed={!genre}>
          Todos
        </button>
        {genres.map((g) => (
          <button key={g.slug} className={`chip ${genre === g.slug ? 'is-active' : ''}`} onClick={() => set('genero', genre === g.slug ? '' : g.slug)} aria-pressed={genre === g.slug}>
            {g.name}
          </button>
        ))}
      </div>

      <div ref={grid} aria-busy={loading}>
        {error ? (
          <ErrorState error={error} onRetry={() => setNonce((n) => n + 1)} />
        ) : loading && page === 1 ? (
          <div className="grid-titles">
            {Array.from({ length: 12 }, (_, i) => (
              <TitleCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length ? (
          <>
            <p className="dim results-count" aria-live="polite">
              {items.length} {items.length === 1 ? 'título' : 'títulos'}
              {totalPages > page ? '+' : ''}
            </p>
            <div className="grid-titles">
              {items.map((t) => (
                <TitleCard key={t.id} title={t} />
              ))}
            </div>
            {page < totalPages && (
              <div className="center">
                <button className="btn btn--glass" onClick={more} disabled={loading}>
                  {loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="search" title="Nada encontrado" action={<button className="btn btn--ghost" onClick={() => setParams({})}>Limpar filtros</button>}>
            {q ? `Nenhum título combina com “${q}”` : 'Nenhum título com esses filtros.'}
            {source === 'demo' && ' O catálogo demo tem apenas 32 títulos.'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
