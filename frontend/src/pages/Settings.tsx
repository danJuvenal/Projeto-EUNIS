import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { GenrePicker } from '../components/GenrePicker'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { useDocumentTitle } from '../lib/hooks'

export default function Settings() {
  useDocumentTitle('Configurações')
  const { user, update, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [hue, setHue] = useState(user?.avatar_hue ?? 262)
  const [genres, setGenres] = useState(user?.favorite_genres.map((g) => g.slug) ?? [])
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await update({ name, bio, avatar_hue: hue, favorite_genres: genres })
      toast('Perfil salvo', { tone: 'success' })
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const togglePresence = async (v: boolean) => {
    try {
      await update({ show_online: v })
      toast(v ? 'Seu status online está visível' : 'Você está invisível', { tone: 'success' })
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    }
  }

  return (
    <div className="container page settings">
      <header className="page__head">
        <div>
          <p className="eyebrow">@{user.username}</p>
          <h1 className="page__title">Configurações</h1>
        </div>
      </header>

      <form className="panel form" onSubmit={save}>
        <h2 className="h-section">Perfil</h2>
        <div className="settings__avatar">
          <Avatar user={{ ...user, name: name || user.name, avatar_hue: hue }} size={72} ring={false} />
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="hue">
              Cor do avatar
            </label>
            <input id="hue" type="range" min={0} max={359} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="range" />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="s-name">
            Nome
          </label>
          <input id="s-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="s-bio">
            Bio
          </label>
          <textarea id="s-bio" className="input textarea" rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Uma frase sobre o seu gosto" />
          <span className="field__hint dim mono">{bio.length}/280</span>
        </div>
        <div className="field">
          <span className="field__label">Gêneros favoritos</span>
          <GenrePicker value={genres} onChange={setGenres} />
        </div>
        <div className="form__actions">
          <button className="btn btn--primary" disabled={busy || name.trim().length < 2}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      <section className="panel">
        <h2 className="h-section">Privacidade</h2>
        <label className="switch">
          <input type="checkbox" checked={user.show_online} onChange={(e) => togglePresence(e.target.checked)} />
          <span className="switch__track" aria-hidden="true" />
          <span>
            <strong>Mostrar quando estou online</strong>
            <span className="muted"> Desligado, você some da lista de pessoas online (e continua vendo quem está).</span>
          </span>
        </label>
        <p className="dim panel__foot">Seu e-mail nunca aparece para outras pessoas.</p>
      </section>

      <section className="panel">
        <h2 className="h-section">Conta</h2>
        <p className="muted">E-mail: {user.email}</p>
        <button
          className="btn btn--ghost"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          Sair da conta
        </button>
      </section>
    </div>
  )
}
