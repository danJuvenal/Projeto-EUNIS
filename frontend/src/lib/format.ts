import type { TitleSummary } from './types'

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'agora'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function runtime(min: number | null, seasons: number | null): string | null {
  if (seasons) return seasons === 1 ? '1 temporada' : `${seasons} temporadas`
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}

export function mediaLabel(t: Pick<TitleSummary, 'media_type'>): string {
  return t.media_type === 'tv' ? 'Série' : 'Filme'
}

/** Nota em meias estrelas (1..10) → texto "4,5". */
export function stars(rating: number | null | undefined): string {
  if (rating == null) return ''
  return (rating / 2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function avg(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
