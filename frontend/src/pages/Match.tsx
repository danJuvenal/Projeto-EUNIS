import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { GenrePicker } from '../components/GenrePicker'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { EmptyState, ErrorState, SourceBadge, Spinner } from '../components/States'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import { mediaLabel } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { gsap, prefersReducedMotion } from '../lib/motion'
import type { MatchCard } from '../lib/types'

type Verdict = 'watchlist' | 'watched' | 'dismissed'

const VERDICTS: Record<Verdict, { label: string; x: number; y: number; rot: number }> = {
  dismissed: { label: 'Passo', x: -1, y: 0, rot: -18 },
  watched: { label: 'Já vi', x: 0, y: 1, rot: 0 },
  watchlist: { label: 'Quero ver', x: 1, y: 0, rot: 18 },
}

/** Match cinematográfico: baralho ordenado pela afinidade real; cada decisão alimenta o gosto. */
export default function Match() {
  useDocumentTitle('Match')
  const { user, update } = useAuth()
  const toast = useToast()
  const [deck, setDeck] = useState<MatchCard[] | null>(null)
  const [hasSignals, setHasSignals] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [history, setHistory] = useState<{ card: MatchCard; verdict: Verdict }[]>([])
  const cardRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api<{ results: MatchCard[]; has_signals: boolean }>('/api/match?limit=20')
      setDeck(r.results)
      setHasSignals(r.has_signals)
    } catch (e) {
      setError(e as Error)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const top = deck?.[0]

  // Entrada da carta do topo
  useEffect(() => {
    if (!cardRef.current || prefersReducedMotion()) return
    gsap.fromTo(cardRef.current, { autoAlpha: 0, y: 24, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6 })
  }, [top?.id])

  const decide = useCallback(
    async (verdict: Verdict) => {
      if (!top || busy.current) return
      busy.current = true
      const v = VERDICTS[verdict]
      const el = cardRef.current
      const fly =
        el && !prefersReducedMotion()
          ? gsap.to(el, { x: v.x * window.innerWidth * 0.6, y: v.y * 300, rotation: v.rot, autoAlpha: 0, duration: 0.45, ease: 'power2.in' })
          : null
      const req = api(`/api/titles/${top.id}/library`, { method: 'PUT', body: { [verdict]: true } })
      try {
        await Promise.all([req, fly?.then()])
        setHistory((h) => [{ card: top, verdict }, ...h].slice(0, 20))
        setDeck((d) => d?.slice(1) ?? null)
        if (verdict !== 'dismissed') toast(verdict === 'watchlist' ? `“${top.title}” no seu quero ver` : `“${top.title}” marcado como assistido`, { tone: 'success' })
      } catch (e) {
        if (el) gsap.set(el, { clearProps: 'all' })
        toast((e as Error).message, { tone: 'error' })
      } finally {
        busy.current = false
      }
    },
    [top, toast],
  )

  const undo = async () => {
    const last = history[0]
    if (!last) return
    try {
      await api(`/api/titles/${last.card.id}/library`, { method: 'PUT', body: { [last.verdict]: false } })
      setHistory((h) => h.slice(1))
      setDeck((d) => [last.card, ...(d ?? [])])
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  // Teclado: ← passo, ↓ já vi, → quero ver
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft') decide('dismissed')
      else if (e.key === 'ArrowRight') decide('watchlist')
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        decide('watched')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide])

  // Arrastar (toque e mouse)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    let dragging = false
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a, button')) return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = Math.max(0, e.clientY - startY)
      gsap.set(el, { x: dx, y: dy * 0.6, rotation: dx / 18 })
      el.dataset.hint = dx > 60 ? 'watchlist' : dx < -60 ? 'dismissed' : dy > 80 ? 'watched' : ''
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      el.dataset.hint = ''
      if (dx > 110) decide('watchlist')
      else if (dx < -110) decide('dismissed')
      else if (dy > 140) decide('watched')
      else gsap.to(el, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)' })
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [top?.id, decide])

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          icon="spark"
          title="O Match precisa saber do que você gosta"
          action={
            <Link to="/cadastro?next=/match" className="btn btn--primary">
              Criar conta para jogar
            </Link>
          }
        >
          Crie uma conta (ou entre) e o EUNIS monta um baralho de filmes e séries a partir dos seus gêneros e notas.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="container page match">
      <header className="page__head">
        <div>
          <p className="eyebrow">
            Match cinematográfico {top && <SourceBadge source={top.source} />}
          </p>
          <h1 className="page__title">
            Um título <span className="serif">por vez</span>
          </h1>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={undo} disabled={!history.length}>
          <Icon name="undo" size={16} /> Desfazer
        </button>
      </header>

      {!hasSignals && (
        <section className="panel match__tune">
          <p>
            <strong>Afine o baralho.</strong> <span className="muted">Escolha gêneros e o Match passa a priorizar o que combina com você.</span>
          </p>
          <GenrePicker value={genres} onChange={setGenres} />
          <button
            className="btn btn--primary btn--sm"
            disabled={!genres.length}
            onClick={async () => {
              await update({ favorite_genres: genres })
              setDeck(null)
              load()
            }}
          >
            Atualizar baralho
          </button>
        </section>
      )}

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : deck === null ? (
        <div className="page-center">
          <Spinner />
        </div>
      ) : !top ? (
        <EmptyState
          icon="check"
          title="Você zerou o baralho"
          action={
            <>
              <Link to="/explorar" className="btn btn--primary">
                Explorar o catálogo
              </Link>{' '}
              <button className="btn btn--ghost" onClick={load}>
                Recarregar
              </button>
            </>
          }
        >
          Não há mais títulos que você ainda não tenha visto, salvo ou descartado.
        </EmptyState>
      ) : (
        <div className="match__stage">
          <div className="match__stack" aria-live="polite">
            {deck[1] && <div className="match__under" aria-hidden="true" />}
            <article ref={cardRef} key={top.id} className="match-card" aria-label={`${top.title}, ${top.year ?? ''}`}>
              <div className="match-card__poster">
                <Poster title={top} eager />
              </div>
              <div className="match-card__body">
                <p className="eyebrow">
                  {mediaLabel(top)} · {top.year}
                </p>
                <h2 className="match-card__title">{top.title}</h2>
                <p className="muted">{top.genres.map((g) => g.name).join(' · ')}</p>
                {top.reasons.length > 0 && (
                  <ul className="match-card__reasons">
                    {top.reasons.map((r) => (
                      <li key={r}>
                        <Icon name="spark" size={14} /> {r}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="match-card__overview">{top.overview}</p>
                <Link to={`/titulo/${top.id}`} className="link">
                  Ver detalhes
                </Link>
              </div>
              <span className="match-card__hint match-card__hint--watchlist" aria-hidden="true">
                Quero ver
              </span>
              <span className="match-card__hint match-card__hint--dismissed" aria-hidden="true">
                Passo
              </span>
              <span className="match-card__hint match-card__hint--watched" aria-hidden="true">
                Já vi
              </span>
            </article>
          </div>
          <div className="match__controls">
            <button className="match-btn match-btn--no" onClick={() => decide('dismissed')} aria-label="Passo (seta para a esquerda)">
              <Icon name="x" size={26} />
              <span>Passo</span>
            </button>
            <button className="match-btn match-btn--seen" onClick={() => decide('watched')} aria-label="Já vi (seta para baixo)">
              <Icon name="eye" size={24} />
              <span>Já vi</span>
            </button>
            <button className="match-btn match-btn--yes" onClick={() => decide('watchlist')} aria-label="Quero ver (seta para a direita)">
              <Icon name="bookmark" size={24} />
              <span>Quero ver</span>
            </button>
          </div>
          <p className="dim center-text match__keys">Arraste a carta ou use ← ↓ →</p>
        </div>
      )}
    </div>
  )
}
