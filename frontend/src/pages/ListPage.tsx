import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar, DemoTag } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { TitleCard } from '../components/TitleCard'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import { plural, timeAgo } from '../lib/format'
import { useApi, useDocumentTitle } from '../lib/hooks'
import type { ListSummary } from '../lib/types'
import { ListForm } from './Profile'

export default function ListPage() {
  const { id } = useParams()
  const q = useApi<ListSummary>(`/api/lists/${id}`)
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  useDocumentTitle(q.data?.name)

  if (q.error) return <div className="container page"><ErrorState error={q.error} onRetry={q.reload} /></div>
  if (!q.data) return <div className="page-center"><Spinner /></div>
  const l = q.data

  const remove = async (titleId: number) => {
    try {
      const updated = await api<ListSummary>(`/api/lists/${l.id}/items/${titleId}`, { method: 'DELETE' })
      q.setData(updated)
      toast('Removido da lista')
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const destroy = async () => {
    if (!window.confirm(`Excluir a lista "${l.name}"? Isso não pode ser desfeito.`)) return
    try {
      await api(`/api/lists/${l.id}`, { method: 'DELETE' })
      toast('Lista excluída')
      navigate('/listas')
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: l.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copiado', { tone: 'success' })
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <div className="container page">
      <header className="list-head">
        <div className="list-head__covers" aria-hidden="true">
          {l.covers.length ? l.covers.map((c) => <TitleCover key={c.id} t={c} />) : <span className="list-card__empty"><Icon name="list" /></span>}
        </div>
        <div>
          <p className="eyebrow">
            {l.is_public ? (
              <>
                <Icon name="globe" size={14} /> Lista pública
              </>
            ) : (
              <>
                <Icon name="lock" size={14} /> Lista privada
              </>
            )}
          </p>
          <h1 className="page__title">{l.name}</h1>
          {l.description && <p className="muted list-head__desc">{l.description}</p>}
          <p className="list-head__by">
            <Link to={`/u/${l.user.username}`} className="review__author">
              <Avatar user={l.user} size={26} /> {l.user.name}
            </Link>
            {l.user.is_demo && <DemoTag />}
            <span className="dim">
              · {plural(l.count, 'título', 'títulos')} · atualizada {timeAgo(l.updated_at)}
            </span>
          </p>
          <div className="list-head__actions">
            {l.is_public && (
              <button className="btn btn--glass btn--sm" onClick={share}>
                Compartilhar
              </button>
            )}
            {l.is_mine && (
              <>
                <button className="btn btn--glass btn--sm" onClick={() => setEditing(true)}>
                  <Icon name="edit" size={14} /> Editar
                </button>
                <button className="btn btn--ghost btn--sm btn--danger" onClick={destroy}>
                  <Icon name="trash" size={14} /> Excluir
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {l.items?.length ? (
        <div className="grid-titles">
          {l.items.map((t, i) => (
            <div key={t.id} className="list-item">
              <span className="list-item__n mono dim">{i + 1}</span>
              <TitleCard title={t} />
              {l.is_mine && (
                <button className="chip-btn chip-btn--danger" onClick={() => remove(t.id)} aria-label={`Remover ${t.title} da lista`}>
                  <Icon name="x" size={14} /> Remover
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="list"
          title="Lista vazia"
          action={
            l.is_mine && (
              <Link to="/explorar" className="btn btn--primary">
                Encontrar títulos
              </Link>
            )
          }
        >
          {l.is_mine ? 'Abra qualquer título e use o botão “Lista”.' : 'Ainda não há títulos aqui.'}
        </EmptyState>
      )}
      {l.is_mine && <ListForm open={editing} onClose={() => setEditing(false)} list={l} onSaved={(nl) => q.setData(nl)} />}
    </div>
  )
}

function TitleCover({ t }: { t: ListSummary['covers'][number] }) {
  return (
    <div className="list-head__cover">
      {t.poster_url ? <img src={t.poster_url} alt="" loading="lazy" /> : <span style={{ background: `linear-gradient(160deg, ${t.palette[0]}, ${t.palette[1]})` }} />}
    </div>
  )
}
