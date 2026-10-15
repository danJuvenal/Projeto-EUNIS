import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../components/Icon'
import { ListPicker } from '../components/ListPicker'
import { Poster } from '../components/Poster'
import { RatingBars, StarInput } from '../components/Rating'
import { ReviewCard } from '../components/ReviewCard'
import { ReviewEditor } from '../components/ReviewEditor'
import { EmptyState, ErrorState, SourceBadge, Spinner } from '../components/States'
import { TitleCard } from '../components/TitleCard'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import { mediaLabel, runtime } from '../lib/format'
import { useApi, useDocumentTitle } from '../lib/hooks'
import { gsap, pop, useGsap } from '../lib/motion'
import type { Review, TitleDetail as TD, TitleSummary } from '../lib/types'
import { useLibrary } from '../lib/useLibrary'

export default function TitleDetail() {
  const { id } = useParams()
  const q = useApi<TD>(`/api/titles/${id}`)
  useDocumentTitle(q.data?.title)
  if (q.error) return <div className="container page"><ErrorState error={q.error} onRetry={q.reload} /></div>
  if (!q.data) return <div className="page-center"><Spinner /></div>
  return <Detail key={q.data.id} t={q.data} reload={q.reload} />
}

function Detail({ t, reload }: { t: TD; reload: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const lib = useLibrary(t.id, t.mine?.library)
  const [myReview, setMyReview] = useState<Review | null>(t.mine?.review ?? null)
  const [editor, setEditor] = useState(false)
  const [picker, setPicker] = useState(false)
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const reviews = useApi<{ results: Review[] }>(`/api/titles/${t.id}/reviews?sort=${sort}`)
  const related = useApi<{ results: TitleSummary[] }>(`/api/titles/${t.id}/related`)
  const heart = useRef<HTMLButtonElement>(null)

  useGsap(
    ({ motion }) => {
      if (!motion) return
      const tl = gsap.timeline()
      tl.from('.detail__backdrop', { autoAlpha: 0, scale: 1.06, duration: 1.2, ease: 'power2.out' })
        .from('.detail__poster', { autoAlpha: 0, y: 24, rotate: -2, duration: 0.8 }, 0)
        .from('.detail__info > *', { autoAlpha: 0, y: 14, stagger: 0.04, duration: 0.6 }, 0.08)
    },
    [],
    root,
  )

  const quickRate = async (v: number | null) => {
    if (lib.requireLogin()) return
    if (v == null && !myReview?.body) {
      if (myReview) {
        await api(`/api/reviews/${myReview.id}`, { method: 'DELETE' })
        setMyReview(null)
        toast('Nota removida')
        reload()
      }
      return
    }
    try {
      const r = await api<Review>(`/api/titles/${t.id}/review`, {
        method: 'PUT',
        body: { rating: v, body: myReview?.body ?? '', spoilers: myReview?.spoilers ?? false },
      })
      setMyReview(r)
      lib.setState((s) => ({ ...s, watched: true, watchlist: false }))
      toast(v ? `Sua nota: ${(v / 2).toLocaleString('pt-BR')}★` : 'Nota removida', { tone: 'success' })
      reviews.reload()
      reload()
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const meta = [mediaLabel(t), t.year, runtime(t.runtime_min, t.seasons), t.country].filter(Boolean).join(' · ')
  const [c1, c2] = t.palette.length >= 2 ? t.palette : ['#2a2433', '#0f0d12']

  return (
    <div ref={root} className="detail">
      <div className="detail__backdrop" aria-hidden="true" style={{ '--c1': c1, '--c2': c2 } as React.CSSProperties}>
        {t.backdrop_url && <img src={t.backdrop_url} alt="" />}
      </div>
      <div className="container detail__top">
        <div className="detail__poster">
          <Poster title={t} eager />
        </div>
        <div className="detail__info">
          <p className="eyebrow">
            {meta} <SourceBadge source={t.source} />
          </p>
          <h1 className="detail__title">{t.title}</h1>
          {t.original_title && t.original_title !== t.title && <p className="dim">{t.original_title}</p>}
          <div className="detail__genres">
            {t.genres.map((g) => (
              <Link key={g.slug} to={`/explorar?genero=${g.slug}`} className="chip chip--sm">
                {g.name}
              </Link>
            ))}
          </div>
          {t.director && (
            <p className="detail__credit">
              <span className="dim">{t.media_type === 'tv' ? 'Criação' : 'Direção'}</span> {t.director}
            </p>
          )}

          <div className="action-bar" role="group" aria-label="Suas ações">
            <button className={`action ${lib.state.watched ? 'is-on' : ''}`} onClick={() => lib.toggle('watched')} aria-pressed={lib.state.watched} disabled={lib.busy}>
              <Icon name="eye" size={20} />
              <span>{lib.state.watched ? 'Assistido' : 'Assisti'}</span>
            </button>
            <button className={`action ${lib.state.watchlist ? 'is-on' : ''}`} onClick={() => lib.toggle('watchlist')} aria-pressed={lib.state.watchlist} disabled={lib.busy}>
              <Icon name="bookmark" size={20} filled={lib.state.watchlist} />
              <span>Quero ver</span>
            </button>
            <button
              ref={heart}
              className={`action action--heart ${lib.state.favorite ? 'is-on' : ''}`}
              onClick={() => {
                pop(heart.current)
                lib.toggle('favorite')
              }}
              aria-pressed={lib.state.favorite}
              disabled={lib.busy}
            >
              <Icon name="heart" size={20} filled={lib.state.favorite} />
              <span>Favorito</span>
            </button>
            <button className="action" onClick={() => !lib.requireLogin() && setPicker(true)}>
              <Icon name="list" size={20} />
              <span>Lista</span>
            </button>
          </div>

          <div className="rate-box">
            <div>
              <span className="field__label">{myReview?.rating ? 'Sua nota' : 'Avalie'}</span>
              <StarInput value={myReview?.rating ?? null} onChange={quickRate} size={30} />
            </div>
            <button className="btn btn--glass" onClick={() => !lib.requireLogin() && setEditor(true)}>
              <Icon name="edit" size={16} /> {myReview?.body ? 'Editar crítica' : 'Escrever crítica'}
            </button>
          </div>
        </div>
      </div>

      <div className="container detail__body">
        <div className="detail__main">
          {t.overview && (
            <section className="detail__section">
              <h2 className="h-section">Sinopse</h2>
              <p className="detail__overview">{t.overview}</p>
            </section>
          )}
          {t.cast.length > 0 && (
            <section className="detail__section">
              <h2 className="h-section">Elenco</h2>
              <ul className="cast">
                {t.cast.map((c) => (
                  <li key={c} className="chip chip--static">
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {t.themes.length > 0 && (
            <section className="detail__section">
              <h2 className="h-section">Temas</h2>
              <div className="cast">
                {t.themes.map((th) => (
                  <Link key={th} to={`/explorar?q=${encodeURIComponent(th)}`} className="chip chip--sm">
                    {th}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="detail__section" aria-labelledby="reviews-h">
            <div className="section-row">
              <h2 id="reviews-h" className="h-section">
                Críticas <span className="dim mono">{t.stats.reviews}</span>
              </h2>
              <div className="segmented segmented--sm" role="radiogroup" aria-label="Ordenar críticas">
                {(['recent', 'popular'] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={sort === s} className={sort === s ? 'is-active' : ''} onClick={() => setSort(s)}>
                    {s === 'recent' ? 'Recentes' : 'Populares'}
                  </button>
                ))}
              </div>
            </div>
            {reviews.error ? (
              <ErrorState error={reviews.error} onRetry={reviews.reload} />
            ) : reviews.loading && !reviews.data ? (
              <Spinner />
            ) : reviews.data?.results.length ? (
              <div className="stack">
                {reviews.data.results.map((r) => (
                  <ReviewCard
                    key={`${r.id}-${r.updated_at}`}
                    review={r}
                    onEdit={() => setEditor(true)}
                    onDeleted={() => {
                      setMyReview(null)
                      reviews.reload()
                      reload()
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="chat"
                title="Nenhuma crítica ainda"
                action={
                  <button className="btn btn--primary" onClick={() => !lib.requireLogin() && setEditor(true)}>
                    Escrever a primeira
                  </button>
                }
              />
            )}
          </section>
        </div>

        <aside className="detail__side">
          <div className="panel">
            <h2 className="h-section">Comunidade EUNIS</h2>
            <RatingBars distribution={t.stats.distribution} average={t.stats.avg} total={t.stats.ratings} />
            <dl className="mini-stats">
              <div>
                <dt className="dim">Assistiram</dt>
                <dd className="mono">{t.stats.watched}</dd>
              </div>
              <div>
                <dt className="dim">Críticas</dt>
                <dd className="mono">{t.stats.reviews}</dd>
              </div>
              {t.tmdb_rating != null && (
                <div>
                  <dt className="dim">TMDb</dt>
                  <dd className="mono">{t.tmdb_rating.toFixed(1)}</dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>

      {related.data && related.data.results.length > 0 && (
        <section className="container detail__section">
          <h2 className="h-section">Se você gostou, veja também</h2>
          <div className="rail">
            {related.data.results.map((r) => (
              <TitleCard key={r.id} title={r} size="sm" />
            ))}
          </div>
        </section>
      )}

      {user && (
        <>
          <ReviewEditor
            open={editor}
            onClose={() => setEditor(false)}
            titleId={t.id}
            titleName={t.title}
            existing={myReview}
            onSaved={(r) => {
              setMyReview(r)
              lib.setState((s) => ({ ...s, watched: true, watchlist: false }))
              reviews.reload()
              reload()
            }}
          />
          <ListPicker open={picker} onClose={() => setPicker(false)} titleId={t.id} titleName={t.title} />
        </>
      )}
    </div>
  )
}
