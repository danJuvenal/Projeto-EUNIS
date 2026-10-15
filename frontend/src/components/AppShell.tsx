import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../context/auth'
import { usePresence } from '../context/presence'
import { useToast } from '../context/toast'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { Avatar } from './Avatar'
import { Footer } from './Footer'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { Spinner } from './States'

function SearchBox() {
  const navigate = useNavigate()
  const location = useLocation()
  const [q, setQ] = useState('')
  useEffect(() => {
    if (location.pathname.startsWith('/explorar')) setQ(new URLSearchParams(location.search).get('q') ?? '')
  }, [location])
  return (
    <form
      role="search"
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault()
        navigate(`/explorar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
      }}
    >
      <Icon name="search" size={18} />
      <label htmlFor="global-search" className="sr-only">
        Buscar filmes e séries
      </label>
      <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar filmes e séries" />
    </form>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  if (!user) return null
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar user={user} size={34} />
        <span className="sr-only">Menu da conta</span>
      </button>
      {open && (
        <div className="user-menu__pop" role="menu" onClick={() => setOpen(false)}>
          <div className="user-menu__who">
            <strong>{user.name}</strong>
            <span className="dim">@{user.username}</span>
          </div>
          <Link role="menuitem" to={`/u/${user.username}`}>
            <Icon name="user" size={16} /> Perfil
          </Link>
          <Link role="menuitem" to="/listas">
            <Icon name="list" size={16} /> Minhas listas
          </Link>
          <Link role="menuitem" to="/configuracoes">
            <Icon name="settings" size={16} /> Configurações
          </Link>
          <button
            role="menuitem"
            onClick={async () => {
              await logout()
              toast('Você saiu da sua conta')
              navigate('/')
            }}
          >
            <Icon name="logout" size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const { user } = useAuth()
  const { count, connected } = usePresence()
  const location = useLocation()
  const main = useRef<HTMLElement>(null)

  // Transição de página: fade curto + leve subida; volta ao topo
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    if (prefersReducedMotion() || !main.current) return
    const t = gsap.fromTo(main.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform' })
    return () => {
      t.kill()
    }
  }, [location.pathname])

  const tabs: { to: string; label: string; icon: IconName; end?: boolean }[] = [
    user ? { to: '/feed', label: 'Feed', icon: 'home' } : { to: '/', label: 'Início', icon: 'home', end: true },
    { to: '/explorar', label: 'Explorar', icon: 'compass' },
    { to: '/match', label: 'Match', icon: 'spark' },
    { to: '/comunidade', label: 'Comunidade', icon: 'users' },
  ]

  return (
    <div className="shell">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <div className="container topbar__inner">
          <Logo to={user ? '/feed' : '/'} />
          <nav className="topbar__nav" aria-label="Principal">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className="topbar__link">
                {t.label}
              </NavLink>
            ))}
          </nav>
          <SearchBox />
          <div className="topbar__right">
            <Link to="/comunidade" className="live-pill" title="Pessoas online agora (tempo real)">
              <span className={`live-pill__dot ${connected ? '' : 'is-off'}`} />
              <span className="mono">{connected ? count : '–'}</span>
              <span className="live-pill__label">online</span>
            </Link>
            {user ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/entrar" className="btn btn--ghost btn--sm topbar__login">
                  Entrar
                </Link>
                <Link to="/cadastro" className="btn btn--primary btn--sm">
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="conteudo" ref={main} className="shell__main">
        <Suspense
          fallback={
            <div className="page-center">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <nav className="tabbar" aria-label="Navegação">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tabbar__item">
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <NavLink to={user ? `/u/${user.username}` : '/entrar'} className="tabbar__item">
          {user ? <Avatar user={user} size={24} ring={false} /> : <Icon name="user" size={22} />}
          <span>{user ? 'Perfil' : 'Entrar'}</span>
        </NavLink>
      </nav>
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready)
    return (
      <div className="page-center">
        <Spinner />
      </div>
    )
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
