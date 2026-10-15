import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { avg, mediaLabel } from '../lib/format'
import { pop, tilt } from '../lib/motion'
import type { TitleSummary } from '../lib/types'
import { useLibrary } from '../lib/useLibrary'
import { Icon } from './Icon'
import { Poster } from './Poster'

/** Card de título: pôster, hover com elevação + detalhes, ação rápida "quero ver". */
export function TitleCard({ title, rank, size = 'md' }: { title: TitleSummary; rank?: number; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const { state, toggle, busy } = useLibrary(title.id, title.library)

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia?.('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    return tilt(el.querySelector('.title-card__frame') as HTMLElement, 5)
  }, [])

  const rating = title.community.avg
  return (
    <article ref={ref} className={`title-card title-card--${size}`}>
      <Link to={`/titulo/${title.id}`} className="title-card__link" aria-label={`${title.title}${title.year ? `, ${title.year}` : ''}`}>
        <div className="title-card__frame">
          <Poster title={title} />
          <div className="title-card__shade" aria-hidden="true">
            <span className="title-card__genres">{title.genres.slice(0, 2).map((g) => g.name).join(' · ')}</span>
            {rating != null && (
              <span className="title-card__score mono">
                <Icon name="star" size={12} filled /> {avg(rating)}
              </span>
            )}
          </div>
        </div>
      </Link>
      <button
        ref={btn}
        type="button"
        className={`title-card__save ${state.watchlist ? 'is-on' : ''}`}
        aria-pressed={state.watchlist}
        aria-label={state.watchlist ? `Tirar ${title.title} do quero ver` : `Quero ver ${title.title}`}
        disabled={busy}
        onClick={() => {
          pop(btn.current)
          toggle('watchlist')
        }}
      >
        <Icon name={state.watchlist ? 'check' : 'plus'} size={16} />
      </button>
      <div className="title-card__meta">
        <Link to={`/titulo/${title.id}`} className="title-card__title">
          {title.title}
        </Link>
        <span className="title-card__sub dim">
          {rank != null && <span className="title-card__rank mono">#{String(rank).padStart(2, '0')}</span>}
          {title.year ?? '—'} · {mediaLabel(title)}
        </span>
      </div>
    </article>
  )
}

export function TitleCardSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`title-card title-card--${size}`} aria-hidden="true">
      <div className="title-card__frame skeleton" />
      <div className="title-card__meta">
        <span className="skeleton skeleton--text" style={{ width: '80%' }} />
        <span className="skeleton skeleton--text" style={{ width: '40%' }} />
      </div>
    </div>
  )
}
