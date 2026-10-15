import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Avatar, DemoTag } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ReviewCard } from '../components/ReviewCard'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { TitleCard } from '../components/TitleCard'
import { useAuth } from '../context/auth'
import { usePresence } from '../context/presence'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useApi, useDocumentTitle } from '../lib/hooks'
import { gsap, pop, useGsap } from '../lib/motion'
import type { Compat, ListSummary, Profile as P, Review, TitleSummary } from '../lib/types'
import { ListCard } from './Social'

type Tab = 'watched' | 'watchlist' | 'reviews' | 'lists'

export default function Profile() {
  const { username = '' } = useParams()
  const q = useApi<P>(`/api/users/${encodeURIComponent(username)}`)
  useDocumentTitle(q.data ? `${q.data.name} (@${q.data.username})` : null)
  if (q.error) return <div className="container page"><ErrorState error={q.error} onRetry={q.reload} /></div>
  if (!q.data) return <div className="page-center"><Spinner /></div>
  return <ProfileView key={q.data.id} p={q.data} />
}

function ProfileView({ p }: { p: P }) {
  const { user } = useAuth()
  const { isOnline } = usePresence()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('watched')
  const [followed, setFollowed] = useState(p.followed_by_me)
  const [followers, setFollowers] = useState(p.stats.followers)
  const followBtn = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const online = isOnline(p.id)

  useGsap(
    ({ motion }) => {
      if (!motion) return
      gsap.from('.profile__hero > *', { autoAlpha: 0, y: 20, stagger: 0.07, duration: 0.9 })
      gsap.from('.taste__bar span', { scaleX: 0, transformOrigin: 'left', stagger: 0.06, duration: 1.1, delay: 0.3 })
    },
    [],
    root,
  )

  const follow = async () => {
    if (!user) return navigate(`/entrar?next=/u/${p.username}`)
    pop(followBtn.current)
    const next = !followed
    setFollowed(next)
    setFollowers((n) => n + (next ? 1 : -1))
    try {
      await api(`/api/users/${p.username}/follow`, { method: next ? 'PUT' : 'DELETE' })
      toast(next ? `Seguindo ${p.name}` : `Você deixou de seguir ${p.name}`, { tone: next ? 'success' : 'default' })
    } catch (e) {
      setFollowed(!next)
      setFollowers((n) => n + (next ? -1 : 1))
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const favs = [...p.favorites.movies, ...p.favorites.series]
  const stats: [string, number, string?][] = [
    ['Assistidos', p.stats.watched, 'watched'],
    ['Críticas', p.stats.reviews, 'reviews'],
    ['Listas', p.stats.lists, 'lists'],
    ['Seguidores', followers],
    ['Seguindo', p.stats.following],
  ]

  return (
    <div ref={root} className="profile">
      <div className="profile__glow" style={{ '--h': p.avatar_hue } as React.CSSProperties} aria-hidden="true" />
      <div className="container">
        <header className="profile__hero">
          <Avatar user={p} size={112} />
          <div className="profile__id">
            <h1 className="profile__name">
              {p.name} {p.is_demo && <DemoTag />}
            </h1>
            <p className="dim">
              @{p.username}
              {online ? (
                <span className="profile__status is-online"> · online agora</span>
              ) : p.last_seen_at ? (
                <span className="profile__status"> · visto {timeAgo(p.last_seen_at)}</span>
              ) : null}
              {p.follows_me && <span className="tag">segue você</span>}
            </p>
            {p.bio && <p className="profile__bio serif">“{p.bio}”</p>}
          </div>
          <div className="profile__cta">
            {p.is_me ? (
              <Link to="/configuracoes" className="btn btn--glass">
                <Icon name="settings" size={16} /> Editar perfil
              </Link>
            ) : (
              <button ref={followBtn} className={`btn ${followed ? 'btn--glass is-on' : 'btn--primary'}`} onClick={follow} aria-pressed={followed}>
                {followed ? (
                  <>
                    <Icon name="check" size={16} /> Seguindo
                  </>
                ) : (
                  'Seguir'
                )}
              </button>
            )}
          </div>
        </header>

        <ul className="profile__stats" aria-label="Números do perfil">
          {stats.map(([label, n, t]) => {
            const inner = (
              <>
                <span className="profile__stat-n mono">{n}</span>
                <span className="dim">{label}</span>
              </>
            )
            return (
              <li key={label}>
                {t ? (
                  <button onClick={() => setTab(t as Tab)} className="profile__stat">
                    {inner}
                  </button>
                ) : (
                  <span className="profile__stat">{inner}</span>
                )}
              </li>
            )
          })}
        </ul>

        <div className="profile__grid">
          <div className="profile__main">
            {favs.length > 0 && (
              <section>
                <h2 className="h-section">
                  <Icon name="heart" size={16} filled /> Favoritos
                </h2>
                <div className="rail">
                  {favs.map((t) => (
                    <TitleCard key={t.id} title={t} size="sm" />
                  ))}
                </div>
              </section>
            )}

            <div className="tabs tabs--underline" role="tablist">
              {(
                [
                  ['watched', 'Assistidos'],
                  ['watchlist', 'Quero ver'],
                  ['reviews', 'Críticas'],
                  ['lists', 'Listas'],
                ] as [Tab, string][]
              ).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>
                  {l}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {tab === 'watched' && <Shelf username={p.username} shelf="watched" empty="Nada assistido por aqui ainda." />}
              {tab === 'watchlist' && <Shelf username={p.username} shelf="watchlist" empty="A lista de quero ver está vazia." />}
              {tab === 'reviews' && <UserReviews username={p.username} />}
              {tab === 'lists' && <UserLists username={p.username} isMe={p.is_me} />}
            </div>
          </div>

          <aside className="profile__side">
            {!p.is_me && user && <CompatCard username={p.username} name={p.name} />}
            <section className="panel">
              <h2 className="h-section">Perfil de gosto</h2>
              {p.taste.length ? (
                <ul className="taste">
                  {p.taste.map((g) => (
                    <li key={g.slug}>
                      <span className="taste__label">
                        <span>{g.name}</span>
                        <span className="dim mono">{Math.round(g.share * 100)}%</span>
                      </span>
                      <span className="taste__bar">
                        <span style={{ width: `${g.share * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dim">Aparece quando houver títulos assistidos ou avaliados.</p>
              )}
              <p className="dim panel__foot">Distribuição de gêneros do que {p.is_me ? 'você assistiu' : 'a pessoa assistiu'} ou avaliou.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Shelf({ username, shelf, empty }: { username: string; shelf: string; empty: string }) {
  const q = useApi<{ results: TitleSummary[] }>(`/api/users/${username}/library?shelf=${shelf}`)
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />
  if (!q.data) return <Spinner />
  if (!q.data.results.length) return <EmptyState icon="film" title={empty} />
  return (
    <div className="grid-titles grid-titles--sm">
      {q.data.results.map((t) => (
        <TitleCard key={t.id} title={t} size="sm" />
      ))}
    </div>
  )
}

function UserReviews({ username }: { username: string }) {
  const q = useApi<{ results: Review[] }>(`/api/users/${username}/reviews`)
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />
  if (!q.data) return <Spinner />
  if (!q.data.results.length) return <EmptyState icon="star" title="Nenhuma crítica ainda" />
  return (
    <div className="stack">
      {q.data.results.map((r) => (
        <ReviewCard key={r.id} review={r} showTitle onDeleted={q.reload} />
      ))}
    </div>
  )
}

export function UserLists({ username, isMe }: { username: string; isMe: boolean }) {
  const q = useApi<{ results: ListSummary[] }>(`/api/users/${username}/lists`)
  const [creating, setCreating] = useState(false)
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />
  if (!q.data) return <Spinner />
  return (
    <>
      {isMe && (
        <button className="btn btn--glass" onClick={() => setCreating(true)} style={{ marginBottom: 16 }}>
          <Icon name="plus" size={16} /> Nova lista
        </button>
      )}
      {q.data.results.length ? (
        <div className="list-grid">
          {q.data.results.map((l) => (
            <ListCard key={l.id} list={l} />
          ))}
        </div>
      ) : (
        <EmptyState icon="list" title={isMe ? 'Você ainda não criou listas' : 'Nenhuma lista pública'} />
      )}
      {isMe && <ListForm open={creating} onClose={() => setCreating(false)} onSaved={q.reload} />}
    </>
  )
}

export function ListForm({
  open,
  onClose,
  onSaved,
  list,
}: {
  open: boolean
  onClose: () => void
  onSaved: (l: ListSummary) => void
  list?: ListSummary
}) {
  const toast = useToast()
  const [name, setName] = useState(list?.name ?? '')
  const [description, setDescription] = useState(list?.description ?? '')
  const [isPublic, setIsPublic] = useState(list?.is_public ?? true)
  const [busy, setBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { name, description, is_public: isPublic }
      const l = list
        ? await api<ListSummary>(`/api/lists/${list.id}`, { method: 'PATCH', body })
        : await api<ListSummary>('/api/lists', { method: 'POST', body })
      toast(list ? 'Lista atualizada' : 'Lista criada', { tone: 'success' })
      onSaved(l)
      onClose()
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={list ? 'Editar lista' : 'Nova lista'}>
      <form className="form" onSubmit={save}>
        <div className="field">
          <label className="field__label" htmlFor="l-name">
            Nome
          </label>
          <input id="l-name" className="input" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} placeholder="Ex.: Clássicos que todo mundo deveria ver" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="l-desc">
            Descrição <span className="dim">(opcional)</span>
          </label>
          <textarea id="l-desc" className="input textarea" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          <span>Pública — qualquer pessoa com o link pode ver</span>
        </label>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" disabled={busy || !name.trim()}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CompatCard({ username, name }: { username: string; name: string }) {
  const q = useApi<Compat>(`/api/users/${username}/compat`)
  const ring = useRef<SVGCircleElement>(null)
  const c = q.data
  useGsap(
    ({ motion }) => {
      if (!motion || !c?.score || !ring.current) return
      gsap.from(ring.current, { strokeDashoffset: 2 * Math.PI * 42, duration: 1.6, ease: 'power3.out' })
    },
    [c?.score],
  )
  if (!c) return <section className="panel"><Spinner /></section>
  const circ = 2 * Math.PI * 42
  return (
    <section className="panel compat" aria-labelledby="compat-h">
      <h2 id="compat-h" className="h-section">
        Compatibilidade com {name.split(' ')[0]}
      </h2>
      {c.enough_data && c.score != null ? (
        <div className="compat__ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" className="compat__track" />
            <circle ref={ring} cx="50" cy="50" r="42" className="compat__value" strokeDasharray={circ} strokeDashoffset={circ * (1 - c.score / 100)} />
          </svg>
          <span className="compat__score mono">{c.score}%</span>
        </div>
      ) : (
        <p className="compat__empty">
          Ainda não dá para calcular: vocês avaliaram <strong className="mono">{c.co_rated}</strong> de {c.min_co_rated} títulos em comum necessários.
        </p>
      )}
      <ul className="compat__facts">
        <li>
          <span className="dim">Títulos avaliados por ambos</span> <span className="mono">{c.co_rated}</span>
        </li>
        {c.rating_similarity != null && (
          <li>
            <span className="dim">Concordância nas notas</span> <span className="mono">{Math.round(c.rating_similarity * 100)}%</span>
          </li>
        )}
        {c.genre_similarity != null && (
          <li>
            <span className="dim">Afinidade de gêneros</span> <span className="mono">{Math.round(c.genre_similarity * 100)}%</span>
          </li>
        )}
      </ul>
      {c.shared_genres.length > 0 && <p className="muted">Vocês curtem {c.shared_genres.join(', ')}.</p>}
      {c.shared.length > 0 && (
        <ul className="compat__shared">
          {c.shared.map((s) => (
            <li key={s.title_id}>
              <Link to={`/titulo/${s.title_id}`}>{s.title}</Link>
              <span className="mono dim">
                você {(s.a / 2).toLocaleString('pt-BR')}★ · {(s.b / 2).toLocaleString('pt-BR')}★
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function MyLists() {
  const { user } = useAuth()
  useDocumentTitle('Minhas listas')
  if (!user) return <Navigate to="/entrar?next=/listas" replace />
  return (
    <div className="container page">
      <header className="page__head">
        <div>
          <p className="eyebrow">@{user.username}</p>
          <h1 className="page__title">Minhas listas</h1>
        </div>
      </header>
      <UserLists username={user.username} isMe />
    </div>
  )
}
