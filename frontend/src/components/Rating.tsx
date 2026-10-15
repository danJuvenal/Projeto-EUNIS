import { useState } from 'react'
import { avg, stars } from '../lib/format'

/** Estrelas somente leitura. rating em meias estrelas (1..10). */
export function Stars({ rating, size = 14 }: { rating: number | null; size?: number }) {
  if (rating == null) return null
  const pct = (rating / 10) * 100
  return (
    <span className="stars" style={{ '--size': `${size}px` } as React.CSSProperties} aria-label={`${stars(rating)} de 5 estrelas`} role="img">
      <span className="stars__fill" style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Entrada de nota com meias estrelas — mouse, toque e teclado (setas). */
export function StarInput({
  value,
  onChange,
  size = 32,
  label = 'Sua nota',
}: {
  value: number | null
  onChange: (v: number | null) => void
  size?: number
  label?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  const fromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width)
    return Math.max(1, Math.ceil((x / r.width) * 10))
  }
  return (
    <div className="star-input">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ? value / 2 : 0}
        aria-valuetext={value ? `${stars(value)} estrelas` : 'Sem nota'}
        className="stars stars--input"
        style={{ '--size': `${size}px` } as React.CSSProperties}
        onPointerMove={(e) => e.pointerType === 'mouse' && setHover(fromEvent(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const v = fromEvent(e as unknown as React.PointerEvent<HTMLDivElement>)
          onChange(v === value ? null : v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(Math.min(10, (value ?? 0) + 1))
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            const v = (value ?? 0) - 1
            onChange(v < 1 ? null : v)
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            onChange(null)
          }
        }}
      >
        <span className="stars__fill" style={{ width: `${shown * 10}%` }} />
      </div>
      <span className="star-input__value mono">{shown ? stars(shown) : '—'}</span>
    </div>
  )
}

/** Distribuição das notas da comunidade (barras de 0,5 a 5). */
export function RatingBars({
  distribution,
  average,
  total,
}: {
  distribution: Record<string, number>
  average: number | null
  total: number
}) {
  const max = Math.max(1, ...Object.values(distribution))
  return (
    <div className={`rating-bars ${total ? '' : 'rating-bars--empty'}`}>
      <div className="rating-bars__head">
        <span className="rating-bars__avg mono">{avg(average)}</span>
        <span className="muted">
          {total ? `${total.toLocaleString('pt-BR')} ${total === 1 ? 'nota' : 'notas'} no EUNIS` : 'Ainda sem notas no EUNIS'}
        </span>
      </div>
      <div className="rating-bars__bars" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => {
          const n = distribution[String(i + 1)] ?? 0
          return (
            <span
              key={i}
              className="rating-bars__bar"
              style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
              title={`${stars(i + 1)}★ — ${n}`}
            />
          )
        })}
      </div>
      <div className="rating-bars__scale dim mono" aria-hidden="true">
        <span>½</span>
        <span>★★★★★</span>
      </div>
    </div>
  )
}
