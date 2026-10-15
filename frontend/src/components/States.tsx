import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon = 'film',
  title,
  children,
  action,
}: {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="state">
      <span className="state__icon">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="state__title">{title}</h3>
      {children && <p className="state__text muted">{children}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon">
        <Icon name="x" size={22} />
      </span>
      <h3 className="state__title">Não deu certo</h3>
      <p className="state__text muted">{error.message}</p>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

/** Selo honesto quando a API está servindo o catálogo de demonstração. */
export function SourceBadge({ source }: { source?: 'demo' | 'tmdb' }) {
  if (source !== 'demo') return null
  return (
    <span
      className="tag tag--source"
      title="Sem TMDB_API_KEY configurada, o EUNIS usa um catálogo de demonstração com 32 títulos e artes tipográficas no lugar dos pôsteres."
    >
      Catálogo demo
    </span>
  )
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  )
}
