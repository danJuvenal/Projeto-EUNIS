import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ActivityItem } from '../components/ActivityItem'
import { Avatar, DemoTag } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { ReviewCard } from '../components/ReviewCard'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { useAuth } from '../context/auth'
import { usePresence } from '../context/presence'
import { api, qs } from '../lib/api'
import { plural } from '../lib/format'
import { useApi, useDebounced, useDocumentTitle } from '../lib/hooks'
import { revealOnScroll, useGsap } from '../lib/motion'
import type { Activity, ListSummary, PublicUser, Review } from '../lib/types'

/* ================================================================ FEED */

export function Feed() {
  useDocumentTitle('Feed')
  const { user } = useAuth()
  const [items, setItems] = useState<Activity[] | null>(null)
  const [following, setFollowing] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const [more, setMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const community = useApi<{ results: Activity[] }>('/api/community/activity?limit=15')
  const root = useRef<HTMLDivElement>(null)

  const load = async (before?: number) => {
    setLoading(true)
    try {
      const r = await api<{ results: Activity[]; following: number }>(`/api/feed${qs({ before, limit: 20 })}`)
      setItems((cur) => (before ? [...(cur ?? []), ...r.results] : r.results))
      setFollowing(r.following)
      setMore(r.results.length === 20)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useGsap(() => revealOnScroll(root.current, { y: 16, stagger: 0.05 }), [items === null], root)

  return (
    <div ref={root} className="container page feed">
      <div className="feed__main">
        <header className="page__head">
          <div>
            <p className="eyebrow">Olá, {user?.name.split(' ')[0]}</p>
            <h1 className="page__title">Seu feed</h1>
          </div>
          <Link to="/match" className="btn btn--glass">
            <Icon name="spark" size={18} /> Jogar o Match
          </Link>
        </header>

        {error ? (
          <ErrorState error={error} onRetry={() => { setError(null); load() }} />
        ) : items === null ? (
          <Spinner />
        ) : (
          <>
            {following === 0 && (
              <div className="callout" data-reveal>
                <Icon name="users" size={22} />
                <div>
                  <strong>Siga pessoas para montar seu feed.</strong>
                  <p className="muted">Por enquanto você vê só a sua atividade. Encontre gente na <Link to="/comunidade" className="link">comunidade</Link>.</p>
                </div>
              </div>
            )}
            {items.length ? (
              <div className="stack">
                {items.map((a) => (
                  <div key={a.id} data-reveal>
                    <ActivityItem a={a} />
                  </div>
                ))}
                {more && (
                  <button className="btn btn--ghost" onClick={() => load(items[items.length - 1]?.id)} disabled={loading}>
                    {loading ? 'Carregando…' : 'Mais antigas'}
                  </button>
                )}
              </div>
            ) : (
              <EmptyState
                icon="film"
                title="Nada no seu feed ainda"
                action={
                  <Link to="/explorar" className="btn btn--primary">
                    Explorar o catálogo
                  </Link>
                }
              >
                Marque algo como assistido, avalie ou crie uma lista — ou siga alguém.
              </EmptyState>
            )}
          </>
        )}
      </div>
      <aside className="feed__side">
        <OnlinePanel />
        <section className="panel">
          <h2 className="h-section">Na comunidade</h2>
          {community.data?.results.length ? (
            community.data.results.slice(0, 8).map((a) => <ActivityItem key={a.id} a={a} compact />)
          ) : (
            <p className="dim">Sem atividade ainda.</p>
          )}
        </section>
      </aside>
    </div>
  )
}

export function OnlinePanel({ limit = 8 }: { limit?: number }) {
  const { users, count, connected } = usePresence()
  return (
    <section className="panel online-panel" aria-labelledby="online-panel-h">
      <h2 id="online-panel-h" className="h-section">
        <span className={`live-dot ${connected ? '' : 'is-off'}`} /> Online agora <span className="dim mono">{connected ? count : '–'}</span>
      </h2>
      {users.length ? (
        <ul className="online-list">
          {users.slice(0, limit).map((p) => (
            <li key={p.user.id}>
              <Link to={`/u/${p.user.username}`} className="online-list__item">
                <Avatar user={p.user} size={34} />
                <span>
                  <strong>
                    {p.user.name} {p.user.is_demo && <DemoTag />}
                  </strong>
                  <span className="dim">{p.activity.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim">{connected ? 'Só você por aqui — ou quem está online escolheu ficar invisível.' : 'Conectando…'}</p>
      )}
    </section>
  )
}

/* ================================================================ COMUNIDADE */

export function Community() {
  useDocumentTitle('Comunidade')
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const members = useApi<{ results: PublicUser[] }>(`/api/users${qs({ q: dq, limit: 24 })}`)
  const reviews = useApi<{ results: Review[] }>('/api/reviews?limit=8')
  const lists = useApi<{ results: ListSummary[] }>('/api/lists?limit=6')
  const stats = useApi<{ members: number; demo_members: number; reviews: number }>('/api/community/stats')
  const root = useRef<HTMLDivElement>(null)
  useGsap(() => revealOnScroll(root.current, { y: 16 }), [], root)

  return (
    <div ref={root} className="container page">
      <header className="page__head" data-reveal>
        <div>
          <p className="eyebrow">
            {stats.data
              ? `${plural(stats.data.members, 'membro', 'membros')}${stats.data.demo_members ? ` · ${stats.data.demo_members} demo` : ''} · ${plural(stats.data.reviews, 'crítica', 'críticas')}`
              : 'Comunidade'}
          </p>
          <h1 className="page__title">
            A sala <span className="serif">está cheia de gente</span>
          </h1>
        </div>
      </header>

      <div className="community-page">
        <div className="community-page__main">
          <section data-reveal>
            <h2 className="h-section">Críticas recentes</h2>
            {reviews.error ? (
              <ErrorState error={reviews.error} onRetry={reviews.reload} />
            ) : reviews.data?.results.length ? (
              <div className="stack">
                {reviews.data.results.map((r) => (
                  <ReviewCard key={r.id} review={r} showTitle />
                ))}
              </div>
            ) : reviews.loading ? (
              <Spinner />
            ) : (
              <EmptyState icon="chat" title="Nenhuma crítica publicada ainda" />
            )}
          </section>

          <section data-reveal>
            <h2 className="h-section">Listas da comunidade</h2>
            {lists.data?.results.length ? (
              <div className="list-grid">
                {lists.data.results.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </div>
            ) : (
              <EmptyState icon="list" title="Nenhuma lista pública ainda" />
            )}
          </section>
        </div>

        <aside className="community-page__side">
          <OnlinePanel limit={12} />
          <section className="panel" data-reveal>
            <h2 className="h-section">Pessoas</h2>
            <label className="sr-only" htmlFor="member-q">
              Buscar pessoas
            </label>
            <input id="member-q" className="input" placeholder="Buscar por nome ou @" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="member-list">
              {members.data?.results.map((m) => (
                <li key={m.id}>
                  <Link to={`/u/${m.username}`} className="online-list__item">
                    <Avatar user={m} size={34} />
                    <span>
                      <strong>
                        {m.name} {m.is_demo && <DemoTag />}
                      </strong>
                      <span className="dim">@{m.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {members.data?.results.length === 0 && <li className="dim">Ninguém encontrado.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link to={`/listas/${list.id}`} className="list-card">
      <span className="list-card__covers">
        {list.covers.length ? (
          list.covers.map((c) => <Poster key={c.id} title={c} />)
        ) : (
          <span className="list-card__empty dim">
            <Icon name="list" />
          </span>
        )}
      </span>
      <span className="list-card__body">
        <strong className="list-card__name">
          {list.name} {!list.is_public && <Icon name="lock" size={14} className="dim" />}
        </strong>
        <span className="dim">
          {list.user.name} {list.user.is_demo && <DemoTag />} · {plural(list.count, 'título', 'títulos')}
        </span>
      </span>
    </Link>
  )
}
