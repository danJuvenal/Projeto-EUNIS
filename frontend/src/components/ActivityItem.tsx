import { Link } from 'react-router'
import { timeAgo } from '../lib/format'
import type { Activity } from '../lib/types'
import { Avatar, DemoTag } from './Avatar'
import { Poster } from './Poster'
import { ReviewCard } from './ReviewCard'
import { Stars } from './Rating'

const VERBS: Record<Activity['kind'], string> = {
  review: 'avaliou',
  watched: 'assistiu',
  watchlist: 'quer ver',
  favorite: 'favoritou',
  list_created: 'criou a lista',
  list_item: 'adicionou à lista',
  follow: 'começou a seguir',
}

/** Uma linha de atividade real. Críticas com texto viram cards completos. */
export function ActivityItem({ a, compact = false }: { a: Activity; compact?: boolean }) {
  if (!compact && a.kind === 'review' && a.review?.body && a.title) {
    return <ReviewCard review={{ ...a.review, title: a.title }} showTitle />
  }
  return (
    <div className={`activity ${compact ? 'activity--compact' : ''}`}>
      <Link to={`/u/${a.user.username}`} className="activity__avatar" aria-hidden="true" tabIndex={-1}>
        <Avatar user={a.user} size={compact ? 30 : 36} />
      </Link>
      <p className="activity__text">
        <Link to={`/u/${a.user.username}`} className="activity__who">
          {a.user.name}
        </Link>
        {a.user.is_demo && <DemoTag />} <span className="muted">{VERBS[a.kind]}</span>{' '}
        {a.kind === 'follow' && a.target_user && (
          <Link to={`/u/${a.target_user.username}`} className="activity__what">
            {a.target_user.name}
          </Link>
        )}
        {a.list && (a.kind === 'list_created' || a.kind === 'list_item') && (
          <>
            {a.kind === 'list_item' && a.title && (
              <>
                <Link to={`/titulo/${a.title.id}`} className="activity__what">
                  {a.title.title}
                </Link>{' '}
                <span className="muted">em</span>{' '}
              </>
            )}
            <Link to={`/listas/${a.list.id}`} className="activity__what">
              {a.list.name}
            </Link>
          </>
        )}
        {a.title && !a.list && (
          <Link to={`/titulo/${a.title.id}`} className="activity__what">
            {a.title.title}
          </Link>
        )}
        {a.kind === 'review' && a.review?.rating != null && (
          <>
            {' '}
            <Stars rating={a.review.rating} size={12} />
          </>
        )}
        <span className="activity__time dim"> · {timeAgo(a.created_at)}</span>
      </p>
      {a.title && !compact && (
        <Link to={`/titulo/${a.title.id}`} className="activity__poster" aria-label={a.title.title}>
          <Poster title={a.title} />
        </Link>
      )}
    </div>
  )
}
