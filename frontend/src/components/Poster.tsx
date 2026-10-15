import { useState } from 'react'
import type { TitleSummary } from '../lib/types'

/**
 * Pôster do título. Com TMDb usa a imagem oficial; no catálogo demo (ou se a imagem falhar)
 * desenha uma arte tipográfica com as cores do título — nunca uma imagem que não corresponda a ele.
 */
export function Poster({
  title,
  className = '',
  eager = false,
  sizes,
}: {
  title: Pick<TitleSummary, 'title' | 'year' | 'poster_url' | 'palette' | 'media_type'>
  className?: string
  eager?: boolean
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)
  if (title.poster_url && !failed) {
    return (
      <div className={`poster ${className}`}>
        <img
          src={title.poster_url}
          alt={`Pôster de ${title.title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          sizes={sizes}
          onError={() => setFailed(true)}
        />
      </div>
    )
  }
  return <PosterArt title={title} className={className} />
}

export function PosterArt({
  title,
  className = '',
}: {
  title: Pick<TitleSummary, 'title' | 'year' | 'palette' | 'media_type'>
  className?: string
}) {
  const [c1, c2] = title.palette.length >= 2 ? title.palette : ['#2a2433', '#0f0d12']
  const long = title.title.length > 22
  return (
    <div
      className={`poster poster--art ${className}`}
      style={{ '--c1': c1, '--c2': c2 } as React.CSSProperties}
      role="img"
      aria-label={`Arte tipográfica de ${title.title}`}
    >
      <span className="poster-art__kind">{title.media_type === 'tv' ? 'Série' : 'Filme'}</span>
      <span className={`poster-art__title ${long ? 'is-long' : ''}`}>{title.title}</span>
      <span className="poster-art__foot">
        <span>{title.year ?? ''}</span>
        <span className="poster-art__mark">EUNIS</span>
      </span>
    </div>
  )
}
