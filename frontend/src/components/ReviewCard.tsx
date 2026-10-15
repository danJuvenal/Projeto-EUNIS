import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { pop } from '../lib/motion'
import type { Comment, Review } from '../lib/types'
import { Avatar, DemoTag } from './Avatar'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { Stars } from './Rating'

/** Crítica: autor, nota, texto (com aviso de spoiler), curtir, comentários, editar/excluir se for sua. */
export function ReviewCard({
  review: initial,
  showTitle = false,
  onEdit,
  onDeleted,
}: {
  review: Review
  showTitle?: boolean
  onEdit?: (r: Review) => void
  onDeleted?: (id: number) => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [review, setReview] = useState(initial)
  const [revealed, setRevealed] = useState(!initial.spoilers)
  const [open, setOpen] = useState(false)
  const likeRef = useRef<HTMLButtonElement>(null)

  const like = async () => {
    if (!user) return navigate('/entrar')
    pop(likeRef.current)
    const liked = !review.liked
    setReview((r) => ({ ...r, liked, likes: r.likes + (liked ? 1 : -1) }))
    try {
      const r = await api<Review>(`/api/reviews/${review.id}/like`, { method: liked ? 'PUT' : 'DELETE' })
      setReview((cur) => ({ ...cur, likes: r.likes, liked: r.liked }))
    } catch (e) {
      setReview((r) => ({ ...r, liked: !liked, likes: r.likes + (liked ? -1 : 1) }))
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const remove = async () => {
    if (!window.confirm('Excluir sua crítica? Isso não pode ser desfeito.')) return
    try {
      await api(`/api/reviews/${review.id}`, { method: 'DELETE' })
      toast('Crítica excluída')
      onDeleted?.(review.id)
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const t = review.title
  return (
    <article className={`review ${showTitle && t ? 'review--with-title' : ''}`}>
      {showTitle && t && (
        <Link to={`/titulo/${t.id}`} className="review__poster" aria-label={t.title}>
          <Poster title={t} />
        </Link>
      )}
      <div className="review__main">
        <header className="review__head">
          <Link to={`/u/${review.user.username}`} className="review__author">
            <Avatar user={review.user} size={32} />
            <span className="review__name">{review.user.name}</span>
            {review.user.is_demo && <DemoTag />}
          </Link>
          <Stars rating={review.rating} />
          <span className="review__time dim">
            {timeAgo(review.created_at)}
            {review.edited && ' · editada'}
          </span>
        </header>
        {showTitle && t && (
          <Link to={`/titulo/${t.id}`} className="review__title">
            {t.title} <span className="dim">{t.year}</span>
          </Link>
        )}
        {review.body &&
          (revealed ? (
            <p className="review__body">{review.body}</p>
          ) : (
            <button className="review__spoiler" onClick={() => setRevealed(true)}>
              Contém spoilers — toque para ler
            </button>
          ))}
        <footer className="review__actions">
          <button
            ref={likeRef}
            className={`chip-btn ${review.liked ? 'is-on' : ''}`}
            onClick={like}
            aria-pressed={review.liked}
            aria-label={review.liked ? 'Descurtir crítica' : 'Curtir crítica'}
          >
            <Icon name="heart" size={16} filled={review.liked} />
            <span className="mono">{review.likes}</span>
          </button>
          <button className={`chip-btn ${open ? 'is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Icon name="chat" size={16} />
            <span className="mono">{review.comments}</span>
            <span className="sr-only">comentários</span>
          </button>
          {review.is_mine && (
            <span className="review__own">
              {onEdit && (
                <button className="chip-btn" onClick={() => onEdit(review)}>
                  <Icon name="edit" size={15} /> Editar
                </button>
              )}
              <button className="chip-btn chip-btn--danger" onClick={remove}>
                <Icon name="trash" size={15} /> Excluir
              </button>
            </span>
          )}
        </footer>
        {open && (
          <Comments
            reviewId={review.id}
            onCount={(n) => setReview((r) => ({ ...r, comments: n }))}
          />
        )}
      </div>
    </article>
  )
}

function Comments({ reviewId, onCount }: { reviewId: number; onCount: (n: number) => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let alive = true
    api<{ results: Comment[] }>(`/api/reviews/${reviewId}/comments`)
      .then((r) => alive && setItems(r.results))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [reviewId])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const c = await api<Comment>(`/api/reviews/${reviewId}/comments`, { method: 'POST', body: { body: text } })
      const next = [...(items ?? []), c]
      setItems(next)
      onCount(next.length)
      setText('')
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api(`/api/comments/${id}`, { method: 'DELETE' })
      const next = (items ?? []).filter((c) => c.id !== id)
      setItems(next)
      onCount(next.length)
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    }
  }

  return (
    <div className="comments">
      {items === null && <p className="dim">Carregando comentários…</p>}
      {items?.length === 0 && <p className="dim">Ninguém comentou ainda.</p>}
      {items?.map((c) => (
        <div key={c.id} className="comment">
          <Link to={`/u/${c.user.username}`}>
            <Avatar user={c.user} size={26} />
          </Link>
          <div className="comment__body">
            <span className="comment__meta">
              <Link to={`/u/${c.user.username}`} className="comment__name">
                {c.user.name}
              </Link>
              {c.user.is_demo && <DemoTag />}
              <span className="dim"> · {timeAgo(c.created_at)}</span>
            </span>
            <p>{c.body}</p>
          </div>
          {c.is_mine && (
            <button className="icon-btn icon-btn--sm" onClick={() => remove(c.id)} aria-label="Excluir comentário">
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      ))}
      {user ? (
        <form className="comments__form" onSubmit={send}>
          <label className="sr-only" htmlFor={`c-${reviewId}`}>
            Escreva um comentário
          </label>
          <input
            id={`c-${reviewId}`}
            className="input"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Responder…"
          />
          <button className="btn btn--primary btn--sm" disabled={sending || !text.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <p className="dim">
          <Link to="/entrar" className="link">
            Entre
          </Link>{' '}
          para comentar.
        </p>
      )}
    </div>
  )
}
