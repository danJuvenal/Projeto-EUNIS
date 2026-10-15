import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ActivityItem } from '../components/ActivityItem'
import { Avatar, DemoTag } from '../components/Avatar'
import { Footer } from '../components/Footer'
import { Icon, type IconName } from '../components/Icon'
import { Navbar } from '../components/Navbar'
import { Poster } from '../components/Poster'
import { Stars } from '../components/Rating'
import { EmptyState, ErrorState, SourceBadge } from '../components/States'
import { TitleCard, TitleCardSkeleton } from '../components/TitleCard'
import { useAuth } from '../context/auth'
import { usePresence } from '../context/presence'
import { useGenres } from '../lib/catalog'
import { avg, mediaLabel, plural, timeAgo } from '../lib/format'
import { useApi, useDocumentTitle } from '../lib/hooks'
import { gsap, magnetic, revealOnScroll, useGsap } from '../lib/motion'
import type { Activity, ListSummary, Paged, Review, TitleSummary } from '../lib/types'
import { useLibrary } from '../lib/useLibrary'

export default function Landing() {
  useDocumentTitle(null)
  const trending = useApi<Paged<TitleSummary>>('/api/titles/trending?limit=24')
  return (
    <div className="landing">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <Navbar />
      <main id="conteudo">
        <Hero titles={trending.data?.results ?? []} source={trending.data?.source} />
        <Discovery />
        <Community />
        <HowItWorks />
        <OnlineNow />
        <FinalCta titles={trending.data?.results ?? []} />
      </main>
      <Footer />
    </div>
  )
}

/* ================================================================ HERO */

function Hero({ titles, source }: { titles: TitleSummary[]; source?: 'demo' | 'tmdb' }) {
  const root = useRef<HTMLElement>(null)
  const wall = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLAnchorElement>(null)
  const { user } = useAuth()
  const { count, connected } = usePresence()

  // Três colunas de pôsteres, repetidas para preencher a altura
  const columns = useMemo(() => {
    if (!titles.length) return [[], [], []] as TitleSummary[][]
    const cols: TitleSummary[][] = [[], [], []]
    titles.slice(0, 18).forEach((t, i) => cols[i % 3].push(t))
    return cols.map((c) => [...c, ...c].slice(0, 8))
  }, [titles])

  useGsap(
    ({ motion, fine }) => {
      if (!motion) return
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.hero__eyebrow', { autoAlpha: 0, y: 12, duration: 0.8 })
        .from('.hero__line > span', { yPercent: 115, duration: 1.3, stagger: 0.09 }, '<0.1')
        .from('.hero__sub', { autoAlpha: 0, y: 18, duration: 1 }, '-=0.9')
        .from('.hero__ctas > *', { autoAlpha: 0, y: 18, stagger: 0.08, duration: 0.9 }, '-=0.8')
        .from('.hero__beam', { autoAlpha: 0, duration: 2, ease: 'power2.out' }, 0)

      // Parallax de rolagem: cada coluna em velocidade diferente (scrub justifica-se: profundidade)
      gsap.utils.toArray<HTMLElement>('.hero__col').forEach((col, i) => {
        gsap.to(col, {
          yPercent: [-14, -26, -8][i] ?? -10,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 },
        })
      })

      if (fine && wall.current) {
        const xTo = gsap.quickTo(wall.current, 'x', { duration: 1.2, ease: 'power3.out' })
        const yTo = gsap.quickTo(wall.current, 'y', { duration: 1.2, ease: 'power3.out' })
        const onMove = (e: PointerEvent) => {
          xTo((e.clientX / window.innerWidth - 0.5) * -18)
          yTo((e.clientY / window.innerHeight - 0.5) * -12)
        }
        window.addEventListener('pointermove', onMove)
        const off = primary.current ? magnetic(primary.current, 0.2) : undefined
        return () => {
          window.removeEventListener('pointermove', onMove)
          off?.()
        }
      }
    },
    [],
    root,
  )

  // Pôsteres entram quando os dados chegam
  useGsap(
    ({ motion }) => {
      if (!motion || !titles.length) return
      gsap.from('.hero__col .poster', { autoAlpha: 0, y: 40, scale: 0.96, stagger: { each: 0.04, from: 'random' }, duration: 1.1 })
    },
    [titles.length > 0],
    root,
  )

  return (
    <section ref={root} className="hero" aria-labelledby="hero-title">
      <div className="hero__beam" aria-hidden="true" />
      <div ref={wall} className="hero__wall" aria-hidden="true">
        {columns.map((col, i) => (
          <div key={i} className="hero__col">
            {col.map((t, j) => (
              <Poster key={`${t.id}-${j}`} title={t} eager={j < 2} />
            ))}
          </div>
        ))}
      </div>
      <div className="hero__veil" aria-hidden="true" />
      <div className="container hero__content">
        <p className="hero__eyebrow eyebrow">
          {connected && count > 0 ? (
            <>
              <span className="live-dot" /> {plural(count, 'pessoa online agora', 'pessoas online agora')}
            </>
          ) : (
            <>Filmes · Séries · Gente</>
          )}
          <SourceBadge source={source} />
        </p>
        <h1 id="hero-title" className="hero__title">
          <span className="hero__line">
            <span>Seu próximo</span>
          </span>
          <span className="hero__line">
            <span>
              filme <em className="serif hero__accent">favorito</em>
            </span>
          </span>
          <span className="hero__line">
            <span>está esperando.</span>
          </span>
        </h1>
        <p className="hero__sub">
          Descubra filmes e séries, registre o que você assistiu e encontre pessoas que sentem o cinema do mesmo jeito que você.
        </p>
        <div className="hero__ctas">
          <Link ref={primary} to="/explorar" className="btn btn--primary btn--lg">
            Explorar o catálogo <Icon name="arrow" size={18} />
          </Link>
          {user ? (
            <Link to="/feed" className="btn btn--glass btn--lg">
              Ir para o seu feed
            </Link>
          ) : (
            <Link to="/cadastro" className="btn btn--glass btn--lg">
              Criar conta grátis
            </Link>
          )}
        </div>
      </div>
      <a href="#descobrir" className="hero__scroll" aria-label="Rolar para descobrir">
        <span />
      </a>
    </section>
  )
}

/* ================================================================ DESCOBERTA */

type TabKey = 'trending' | 'movie' | 'tv' | 'recent' | 'foryou'

function Discovery() {
  const { user } = useAuth()
  const genres = useGenres()
  const root = useRef<HTMLElement>(null)
  const [tab, setTab] = useState<TabKey>('trending')
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'trending', label: 'Em alta' },
    { key: 'movie', label: 'Filmes' },
    { key: 'tv', label: 'Séries' },
    { key: 'recent', label: 'Lançamentos' },
    ...(user ? [{ key: 'foryou' as TabKey, label: 'Para você' }] : []),
  ]
  const path = {
    trending: '/api/titles/trending?limit=12',
    movie: '/api/titles?type=movie&sort=popular',
    tv: '/api/titles?type=tv&sort=popular',
    recent: '/api/titles?sort=recent',
    foryou: '/api/match?limit=12',
  }[tab]
  const q = useApi<Paged<TitleSummary>>(path)
  const items = (q.data?.results ?? []).slice(0, 12)
  const featured = items[0]

  useGsap(() => revealOnScroll(root.current), [], root)
  useGsap(
    ({ motion }) => {
      if (!motion || q.loading || !items.length) return
      gsap.from('.discovery__rail .title-card', { autoAlpha: 0, y: 24, stagger: 0.04, duration: 0.7 })
      gsap.from('.feature', { autoAlpha: 0, x: -16, duration: 0.8 })
    },
    [tab, q.loading],
    root,
  )

  return (
    <section ref={root} id="descobrir" className="section discovery" aria-labelledby="disc-title">
      <div className="container">
        <header className="section__head" data-reveal>
          <p className="eyebrow">01 — Descobrir</p>
          <h2 id="disc-title" className="section__title">
            Em cartaz <span className="serif">no EUNIS</span>
          </h2>
          <div className="tabs" role="tablist" aria-label="Seleção">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {q.error ? (
          <ErrorState error={q.error} onRetry={q.reload} />
        ) : (
          <div className="discovery__grid" data-reveal>
            {featured ? <Feature key={featured.id} title={featured} /> : <div className="feature skeleton" />}
            <div className="discovery__rail" role="tabpanel">
              {q.loading && !items.length
                ? Array.from({ length: 8 }, (_, i) => <TitleCardSkeleton key={i} size="sm" />)
                : items.slice(1, 9).map((t, i) => <TitleCard key={t.id} title={t} size="sm" rank={tab === 'trending' ? i + 2 : undefined} />)}
              {!q.loading && !items.length && (
                <EmptyState title="Nada por aqui ainda" icon="spark">
                  {tab === 'foryou' ? 'Avalie alguns títulos ou escolha gêneros favoritos para receber recomendações.' : 'O catálogo não retornou títulos.'}
                </EmptyState>
              )}
            </div>
          </div>
        )}

        <div className="genre-cloud" data-reveal>
          <span className="genre-cloud__label dim">Explore por gênero</span>
          {genres.map((g) => (
            <Link key={g.slug} to={`/explorar?genero=${g.slug}`} className="chip">
              {g.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Feature({ title }: { title: TitleSummary }) {
  const { state, toggle, busy } = useLibrary(title.id, title.library)
  const overview = title.overview
  return (
    <article className="feature" style={{ '--c1': title.palette[0] ?? '#2a2433' } as React.CSSProperties}>
      <Link to={`/titulo/${title.id}`} className="feature__poster" tabIndex={-1} aria-hidden="true">
        <Poster title={title} eager />
      </Link>
      <div className="feature__body">
        <p className="eyebrow">
          {mediaLabel(title)} · {title.year}
        </p>
        <h3 className="feature__title">
          <Link to={`/titulo/${title.id}`}>{title.title}</Link>
        </h3>
        <p className="feature__genres muted">{title.genres.map((g) => g.name).join(' · ')}</p>
        {overview && <p className="feature__overview">{overview}</p>}
        <div className="feature__score">
          {title.community.avg != null ? (
            <>
              <Stars rating={Math.round(title.community.avg * 2)} size={16} />
              <span className="mono">{avg(title.community.avg)}</span>
              <span className="dim">· {plural(title.community.count, 'nota', 'notas')}</span>
            </>
          ) : (
            <span className="dim">Ninguém avaliou ainda — seja a primeira nota.</span>
          )}
        </div>
        <div className="feature__actions">
          <Link to={`/titulo/${title.id}`} className="btn btn--primary">
            Ver detalhes
          </Link>
          <button className={`btn btn--glass ${state.watchlist ? 'is-on' : ''}`} onClick={() => toggle('watchlist')} disabled={busy} aria-pressed={state.watchlist}>
            <Icon name={state.watchlist ? 'check' : 'bookmark'} size={18} />
            {state.watchlist ? 'Na sua lista' : 'Quero ver'}
          </button>
        </div>
      </div>
    </article>
  )
}

/* ================================================================ COMUNIDADE */

const FEATURES: { key: string; icon: IconName; title: string; text: string }[] = [
  { key: 'reviews', icon: 'star', title: 'Críticas com meia estrela', text: 'Dê nota, escreva o que ficou com você e marque spoilers.' },
  { key: 'lists', icon: 'list', title: 'Listas que dá vontade de seguir', text: '“Terror para sexta”, “Filmes que me formaram”. Públicas ou só suas.' },
  { key: 'friends', icon: 'users', title: 'Amigos e atividade', text: 'Siga pessoas e veja o que elas assistem, avaliam e salvam.' },
  { key: 'compat', icon: 'spark', title: 'Compatibilidade de gosto', text: 'Compare notas em comum com qualquer perfil — sem porcentagem inventada.' },
]

function Community() {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState('reviews')
  const reviews = useApi<{ results: Review[] }>('/api/reviews?limit=3')
  const lists = useApi<{ results: ListSummary[] }>('/api/lists?limit=2')
  const acts = useApi<{ results: Activity[] }>('/api/community/activity?limit=5')

  useGsap(() => revealOnScroll(root.current), [], root)
  useGsap(
    ({ motion }) => {
      if (!motion) return
      gsap.from(`.preview__panel[data-key="${active}"] > *`, { autoAlpha: 0, y: 16, stagger: 0.06, duration: 0.6 })
    },
    [active, reviews.loading, lists.loading, acts.loading],
    root,
  )

  const review = reviews.data?.results[0]
  const list = lists.data?.results[0]
  const anyDemo =
    !!review?.user.is_demo || !!list?.user.is_demo || !!acts.data?.results.some((a) => a.user.is_demo)

  return (
    <section ref={root} id="comunidade" className="section community" aria-labelledby="com-title">
      <div className="container community__grid">
        <div className="community__copy">
          <p className="eyebrow" data-reveal>
            02 — Comunidade
          </p>
          <h2 id="com-title" className="section__title" data-reveal>
            Uma rede social <span className="serif">feita de cinema</span>
          </h2>
          <p className="muted community__lead" data-reveal>
            Cada filme vira conversa. Você publica, organiza e descobre através de quem tem o gosto parecido com o seu.
          </p>
          <ul className="feature-list" role="tablist" aria-label="Recursos sociais">
            {FEATURES.map((f) => (
              <li key={f.key} data-reveal>
                <button
                  role="tab"
                  aria-selected={active === f.key}
                  className={`feature-list__item ${active === f.key ? 'is-active' : ''}`}
                  onClick={() => setActive(f.key)}
                >
                  <span className="feature-list__icon">
                    <Icon name={f.icon} size={18} />
                  </span>
                  <span>
                    <strong>{f.title}</strong>
                    <span className="muted">{f.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="preview" data-reveal>
          <div className="preview__chrome" aria-hidden="true">
            <span />
            <span />
            <span />
            <span className="preview__url mono">eunis / comunidade</span>
          </div>
          <div className="preview__body" role="tabpanel">
            {active === 'reviews' && (
              <div className="preview__panel" data-key="reviews">
                <p className="preview__label dim">Críticas mais recentes</p>
                {review && review.title ? (
                  <div className="stack">
                    {reviews.data!.results.slice(0, 2).map((rv) =>
                      rv.title ? (
                        <Link key={rv.id} to={`/titulo/${rv.title.id}`} className="mini-review">
                          <Poster title={rv.title} />
                          <span className="mini-review__body">
                            <span className="mini-review__who">
                              <Avatar user={rv.user} size={24} /> {rv.user.name} {rv.user.is_demo && <DemoTag />}
                            </span>
                            <strong>{rv.title.title}</strong>
                            <Stars rating={rv.rating} size={14} />
                            <span className="serif mini-review__quote">“{rv.body}”</span>
                            <span className="dim">
                              <Icon name="heart" size={13} /> {rv.likes} · <Icon name="chat" size={13} /> {rv.comments} · {timeAgo(rv.created_at)}
                            </span>
                          </span>
                        </Link>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <EmptyState title="Nenhuma crítica ainda" icon="star">
                    A primeira crítica do EUNIS pode ser sua.
                  </EmptyState>
                )}
              </div>
            )}
            {active === 'lists' && (
              <div className="preview__panel" data-key="lists">
                <p className="preview__label dim">Lista pública</p>
                {list ? (
                  <Link to={`/listas/${list.id}`} className="mini-list">
                    <span className="mini-list__covers">
                      {list.covers.map((c) => (
                        <Poster key={c.id} title={c} />
                      ))}
                    </span>
                    <strong>{list.name}</strong>
                    <span className="muted">{list.description}</span>
                    <span className="dim">
                      por {list.user.name} {list.user.is_demo && <DemoTag />} · {plural(list.count, 'título', 'títulos')}
                    </span>
                  </Link>
                ) : (
                  <EmptyState title="Nenhuma lista pública ainda" icon="list" />
                )}
              </div>
            )}
            {active === 'friends' && (
              <div className="preview__panel" data-key="friends">
                <p className="preview__label dim">Atividade recente</p>
                {acts.data?.results.length ? (
                  acts.data.results.map((a) => <ActivityItem key={a.id} a={a} compact />)
                ) : (
                  <EmptyState title="Sem atividade ainda" icon="users" />
                )}
              </div>
            )}
            {active === 'compat' && (
              <div className="preview__panel" data-key="compat">
                <p className="preview__label dim">Como calculamos</p>
                <div className="compat-explain">
                  <div className="compat-explain__row">
                    <span className="compat-explain__w mono">70%</span>
                    <span>
                      <strong>Notas em comum</strong>
                      <span className="muted">Quanto vocês concordam nos títulos que ambos avaliaram.</span>
                    </span>
                  </div>
                  <div className="compat-explain__row">
                    <span className="compat-explain__w mono">30%</span>
                    <span>
                      <strong>Perfil de gêneros</strong>
                      <span className="muted">Gêneros favoritos, notas e o que cada um salvou.</span>
                    </span>
                  </div>
                  <p className="dim">Com menos de 3 títulos avaliados por ambos, o EUNIS não mostra porcentagem — mostra quanto falta.</p>
                </div>
              </div>
            )}
          </div>
          <p className="preview__foot dim">
            {anyDemo ? 'Dados reais do banco · inclui contas demo do seed de desenvolvimento' : 'Dados reais do banco do EUNIS'}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================ COMO FUNCIONA */

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'compass', title: 'Descubra', text: 'Busque, filtre por gênero ou jogue o Match para achar algo novo.' },
  { icon: 'eye', title: 'Assista e registre', text: 'Marque como assistido ou guarde no “quero ver”.' },
  { icon: 'star', title: 'Avalie e critique', text: 'Meias estrelas e quantas palavras você quiser.' },
  { icon: 'users', title: 'Compartilhe', text: 'Sua atividade aparece para quem segue você.' },
  { icon: 'spark', title: 'Receba o próximo', text: 'Recomendações a partir do que você realmente gostou.' },
]

function HowItWorks() {
  const root = useRef<HTMLElement>(null)
  useGsap(
    ({ motion }) => {
      revealOnScroll(root.current?.querySelector('.section__head') ?? null)
      if (!motion) return
      const path = root.current?.querySelector<SVGPathElement>('.steps__line path')
      if (path && typeof path.getTotalLength === 'function') {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 55%', scrub: 0.8 },
        })
      }
      gsap.from('.step', {
        autoAlpha: 0,
        y: 30,
        stagger: 0.12,
        duration: 0.9,
        scrollTrigger: { trigger: '.steps', start: 'top 75%', once: true },
      })
    },
    [],
    root,
  )
  return (
    <section ref={root} id="como-funciona" className="section how" aria-labelledby="how-title">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow" data-reveal>
            03 — Como funciona
          </p>
          <h2 id="how-title" className="section__title" data-reveal>
            Do play <span className="serif">à próxima sessão</span>
          </h2>
        </header>
        <div className="steps">
          <svg className="steps__line" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M20 60 C 150 0, 250 120, 400 60 S 650 0, 800 60 S 950 110, 980 60" />
          </svg>
          <ol className="steps__list">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step__num mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="step__icon">
                  <Icon name={s.icon} size={22} />
                </span>
                <h3 className="step__title">{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ================================================================ ONLINE AGORA */

function OnlineNow() {
  const root = useRef<HTMLElement>(null)
  const { users, count, connected } = usePresence()
  const acts = useApi<{ results: Activity[] }>('/api/community/activity?limit=6')
  const stats = useApi<{ members: number; demo_members: number; reviews: number }>('/api/community/stats')
  useGsap(() => revealOnScroll(root.current), [], root)

  // Novos usuários entrando ganham uma entrada suave
  const seen = useRef(new Set<number>())
  useEffect(() => {
    const fresh = users.filter((u) => !seen.current.has(u.user.id))
    fresh.forEach((u) => seen.current.add(u.user.id))
    if (!fresh.length || !window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return
    const els = fresh.map((u) => document.querySelector(`[data-online="${u.user.id}"]`)).filter(Boolean)
    if (els.length) gsap.from(els, { autoAlpha: 0, scale: 0.9, y: 10, stagger: 0.05, duration: 0.6 })
  }, [users])

  const s = stats.data
  return (
    <section ref={root} id="online" className="section online" aria-labelledby="online-title">
      <div className="container">
        <header className="section__head" data-reveal>
          <p className="eyebrow">04 — Na sala agora</p>
          <h2 id="online-title" className="section__title">
            Quem está <span className="serif">online</span>
          </h2>
          <p className="online__count" aria-live="polite">
            <span className={`live-dot ${connected ? '' : 'is-off'}`} />
            <span className="mono">{connected ? count : '–'}</span> {count === 1 ? 'pessoa' : 'pessoas'} agora
            {s && (
              <span className="dim">
                {' '}
                · {plural(s.members, 'membro', 'membros')}
                {s.demo_members > 0 && ` (${s.demo_members} demo)`} · {plural(s.reviews, 'crítica', 'críticas')}
              </span>
            )}
          </p>
        </header>
        <div className="online__grid">
          <div className="online__people" data-reveal>
            {users.length ? (
              <ul className="presence-grid">
                {users.slice(0, 12).map((p) => (
                  <li key={p.user.id} data-online={p.user.id}>
                    <Link to={`/u/${p.user.username}`} className="presence-card">
                      <Avatar user={{ ...p.user }} size={48} />
                      <span className="presence-card__name">
                        {p.user.name} {p.user.is_demo && <DemoTag />}
                      </span>
                      <span className="presence-card__act dim">{p.activity.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="users" title={connected ? 'Ninguém online neste momento' : 'Conectando à presença em tempo real…'}>
                {connected
                  ? 'Assim que alguém entrar no EUNIS, aparece aqui em tempo real. Status online pode ser ocultado nas configurações.'
                  : 'Se o servidor estiver fora do ar, esta área fica vazia em vez de mostrar números inventados.'}
              </EmptyState>
            )}
          </div>
          <aside className="online__feed" data-reveal aria-label="Atividade recente">
            <h3 className="online__feed-title">Agora há pouco</h3>
            {acts.data?.results.length ? (
              acts.data.results.map((a) => <ActivityItem key={a.id} a={a} compact />)
            ) : (
              <p className="dim">Sem atividade registrada ainda.</p>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}

/* ================================================================ CTA FINAL */

function FinalCta({ titles }: { titles: TitleSummary[] }) {
  const root = useRef<HTMLElement>(null)
  const { user } = useAuth()
  useGsap(
    ({ motion }) => {
      revealOnScroll(root.current)
      if (!motion) return
      gsap.fromTo(
        '.final__mosaic',
        { yPercent: 8, scale: 1.08 },
        { yPercent: -6, scale: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 0.6 } },
      )
    },
    [],
    root,
  )
  return (
    <section ref={root} className="final" aria-labelledby="final-title">
      <div className="final__mosaic" aria-hidden="true">
        {titles.slice(0, 16).map((t) => (
          <Poster key={t.id} title={t} />
        ))}
      </div>
      <div className="final__veil" aria-hidden="true" />
      <div className="container final__content">
        <h2 id="final-title" className="final__title" data-reveal>
          Transforme cada filme em uma <span className="serif">experiência compartilhada.</span>
        </h2>
        <div className="hero__ctas" data-reveal>
          {user ? (
            <Link to="/match" className="btn btn--primary btn--lg">
              Jogar o Match <Icon name="spark" size={18} />
            </Link>
          ) : (
            <Link to="/cadastro" className="btn btn--primary btn--lg">
              Criar minha conta <Icon name="arrow" size={18} />
            </Link>
          )}
          <Link to="/explorar" className="btn btn--glass btn--lg">
            Explorar filmes
          </Link>
        </div>
      </div>
    </section>
  )
}
