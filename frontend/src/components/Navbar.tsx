import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../context/auth'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Logo } from './Logo'

const SECTIONS = [
  { id: 'comunidade', label: 'Comunidade' },
  { id: 'como-funciona', label: 'Funcionalidades' },
]

/** Navbar da landing: transparente sobre o hero, vidro ao rolar, indicador da seção atual. */
export function Navbar() {
  const { user } = useAuth()
  const location = useLocation()
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => setOpen(false), [location])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const links = (
    <>
      <NavLink to="/explorar?tipo=movie" className="nav__link">
        Filmes
      </NavLink>
      <NavLink to="/explorar?tipo=tv" className="nav__link">
        Séries
      </NavLink>
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className={`nav__link ${active === s.id ? 'is-active' : ''}`} aria-current={active === s.id ? 'true' : undefined}>
          {s.label}
        </a>
      ))}
    </>
  )

  return (
    <header className={`nav ${solid ? 'is-solid' : ''} ${open ? 'is-open' : ''}`}>
      <div className="container nav__inner">
        <Logo />
        <nav className="nav__links" aria-label="Principal">
          {links}
        </nav>
        <div className="nav__actions">
          {user ? (
            <>
              <Link to="/feed" className="btn btn--glass btn--sm">
                Abrir o app
              </Link>
              <Link to={`/u/${user.username}`} aria-label="Seu perfil">
                <Avatar user={user} size={34} />
              </Link>
            </>
          ) : (
            <>
              <Link to="/entrar" className="btn btn--ghost btn--sm nav__login">
                Entrar
              </Link>
              <Link to="/cadastro" className="btn btn--primary btn--sm">
                Criar conta
              </Link>
            </>
          )}
          <button
            className="icon-btn nav__burger"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
      </div>
      <div id="mobile-menu" className="nav__sheet" hidden={!open}>
        <nav aria-label="Menu" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
          {links}
          {!user && (
            <Link to="/entrar" className="nav__link">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
