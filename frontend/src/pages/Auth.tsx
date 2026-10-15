import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { GenrePicker } from '../components/GenrePicker'
import { Logo } from '../components/Logo'
import { Poster } from '../components/Poster'
import { Spinner } from '../components/States'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { useApi, useDocumentTitle } from '../lib/hooks'
import { gsap, useGsap } from '../lib/motion'
import type { Paged, TitleSummary } from '../lib/types'

/** Só aceita caminhos internos no ?next= (evita open redirect). */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

function AuthLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const posters = useApi<Paged<TitleSummary>>('/api/titles/trending?limit=12')
  const root = useRef<HTMLDivElement>(null)
  useGsap(
    ({ motion }) => {
      if (!motion) return
      gsap.from('.auth__card > *', { autoAlpha: 0, y: 14, stagger: 0.05, duration: 0.7 })
    },
    [],
    root,
  )
  useGsap(
    ({ motion }) => {
      if (!motion || !posters.data) return
      gsap.from('.auth__art .poster', { autoAlpha: 0, y: 30, stagger: { each: 0.05, from: 'random' }, duration: 1 })
    },
    [!!posters.data],
    root,
  )
  return (
    <div ref={root} className="auth">
      <div className="auth__art" aria-hidden="true">
        {posters.data?.results.slice(0, 12).map((t) => (
          <Poster key={t.id} title={t} />
        ))}
        <div className="auth__art-veil" />
        <p className="auth__quote serif">“Cada filme vira conversa.”</p>
      </div>
      <div className="auth__side">
        <Logo />
        <div className="auth__card">
          <h1 className="auth__title">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  useDocumentTitle('Entrar')
  const { user, ready, login } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const next = safeNext(params.get('next'), '/feed')
  // Evita que o redirecionamento de "já logado" atropele o navigate pós-login
  const [submitting, setSubmitting] = useState(false)

  if (ready && user && !submitting) return <Navigate to={next} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(email, password)
      navigate(me.onboarded ? next : `/boas-vindas?next=${encodeURIComponent(next)}`, { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Bem-vindo de volta">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="email">
            E-mail
          </label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            Senha
          </label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy || !email || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted center-text">
          Não tem conta?{' '}
          <Link to={`/cadastro${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="link">
            Criar conta
          </Link>
        </p>
        <p className="dim center-text form__note">Recuperação de senha por e-mail ainda não está disponível.</p>
      </form>
    </AuthLayout>
  )
}

export function Register() {
  useDocumentTitle('Criar conta')
  const { user, ready, register } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const next = safeNext(params.get('next'), '/feed')
  const [submitting, setSubmitting] = useState(false)

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Informe seu nome.'
    if (!/^[a-z0-9_.]{3,24}$/.test(form.username)) e.username = '3 a 24 caracteres: letras minúsculas, números, _ ou .'
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email)) e.email = 'E-mail inválido.'
    if (form.password.length < 8) e.password = 'Mínimo de 8 caracteres.'
    else if (!(/[a-z]/i.test(form.password) && /\d/.test(form.password))) e.password = 'Use letras e números.'
    return e
  }, [form])

  if (ready && user && !submitting) return <Navigate to={next} replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === 'username' ? e.target.value.toLowerCase().replace(/^@/, '') : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, username: true, email: true, password: true })
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    setSubmitting(true)
    try {
      await register(form)
      navigate(`/boas-vindas?next=${encodeURIComponent(next)}`, { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="field">
      <label className="field__label" htmlFor={`r-${k}`}>
        {label}
      </label>
      <input
        id={`r-${k}`}
        className={`input ${touched[k] && errors[k] ? 'is-invalid' : ''}`}
        value={form[k]}
        onChange={set(k)}
        onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
        aria-invalid={!!(touched[k] && errors[k])}
        aria-describedby={touched[k] && errors[k] ? `r-${k}-err` : undefined}
        {...props}
      />
      {touched[k] && errors[k] && (
        <span id={`r-${k}-err`} className="field__error">
          {errors[k]}
        </span>
      )}
    </div>
  )

  return (
    <AuthLayout title="Crie sua conta">
      <form className="form" onSubmit={submit} noValidate>
        {field('name', 'Nome', { autoComplete: 'name', maxLength: 60 })}
        {field('username', 'Nome de usuário (@)', { autoComplete: 'username', maxLength: 24, spellCheck: false })}
        {field('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
        {field('password', 'Senha', { type: 'password', autoComplete: 'new-password', maxLength: 128 })}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Criando…' : 'Criar conta'}
        </button>
        <p className="dim center-text form__note">
          Ao criar a conta você concorda com os <Link to="/termos" className="link">Termos</Link> e a{' '}
          <Link to="/privacidade" className="link">Privacidade</Link>.
        </p>
        <p className="muted center-text">
          Já tem conta?{' '}
          <Link to="/entrar" className="link">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

/** Onboarding: gêneros favoritos (alimentam Match e recomendações). */
export function Welcome() {
  useDocumentTitle('Boas-vindas')
  const { user, ready, update } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [genres, setGenres] = useState<string[]>(user?.favorite_genres.map((g) => g.slug) ?? [])
  const [busy, setBusy] = useState(false)
  const next = safeNext(params.get('next'), '/feed')

  if (!ready) return <div className="page-center"><Spinner /></div>
  if (!user) return <Navigate to="/entrar" replace />

  const finish = async (save: boolean) => {
    setBusy(true)
    try {
      await update(save ? { favorite_genres: genres, onboarded: true } : { onboarded: true })
      navigate(next === '/feed' && save ? '/match' : next, { replace: true })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome container">
      <Logo />
      <p className="eyebrow">Passo 1 de 1</p>
      <h1 className="page__title">
        Oi, {user.name.split(' ')[0]}. <span className="serif">Do que você gosta?</span>
      </h1>
      <p className="muted">Escolha até 8 gêneros. Usamos isso no Match e nas recomendações — dá para mudar quando quiser.</p>
      <GenrePicker value={genres} onChange={setGenres} />
      <div className="form__actions">
        <button className="btn btn--ghost" onClick={() => finish(false)} disabled={busy}>
          Pular
        </button>
        <button className="btn btn--primary btn--lg" onClick={() => finish(true)} disabled={busy || !genres.length}>
          Continuar {genres.length > 0 && <span className="mono">({genres.length})</span>}
        </button>
      </div>
    </div>
  )
}
