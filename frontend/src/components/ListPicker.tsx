import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import type { ListSummary } from '../lib/types'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** Adicionar/remover um título das suas listas, ou criar uma nova na hora. */
export function ListPicker({
  open,
  onClose,
  titleId,
  titleName,
}: {
  open: boolean
  onClose: () => void
  titleId: number
  titleName: string
}) {
  const toast = useToast()
  const [lists, setLists] = useState<ListSummary[] | null>(null)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState<number | 'new' | null>(null)

  useEffect(() => {
    if (!open) return
    setLists(null)
    api<{ results: ListSummary[] }>(`/api/lists/mine?title_id=${titleId}`)
      .then((r) => setLists(r.results))
      .catch((e) => {
        toast((e as Error).message, { tone: 'error' })
        setLists([])
      })
  }, [open, titleId, toast])

  const toggle = async (l: ListSummary) => {
    setBusy(l.id)
    try {
      if (l.has_title) {
        await api(`/api/lists/${l.id}/items/${titleId}`, { method: 'DELETE' })
      } else {
        await api(`/api/lists/${l.id}/items`, { method: 'POST', body: { title_id: titleId } })
      }
      setLists((ls) => ls?.map((x) => (x.id === l.id ? { ...x, has_title: !l.has_title, count: x.count + (l.has_title ? -1 : 1) } : x)) ?? null)
      toast(l.has_title ? `Removido de "${l.name}"` : `Adicionado a "${l.name}"`, {
        tone: l.has_title ? 'default' : 'success',
        action: l.has_title ? undefined : { label: 'Abrir lista', to: `/listas/${l.id}` },
      })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy('new')
    try {
      const l = await api<ListSummary>('/api/lists', { method: 'POST', body: { name, is_public: isPublic } })
      await api(`/api/lists/${l.id}/items`, { method: 'POST', body: { title_id: titleId } })
      setLists((ls) => [{ ...l, count: 1, has_title: true }, ...(ls ?? [])])
      setName('')
      toast(`Lista "${l.name}" criada`, { tone: 'success', action: { label: 'Abrir', to: `/listas/${l.id}` } })
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar à lista">
      <p className="muted" style={{ marginBottom: 16 }}>
        {titleName}
      </p>
      <form className="list-picker__new" onSubmit={create}>
        <label className="sr-only" htmlFor="new-list">
          Nome da nova lista
        </label>
        <input
          id="new-list"
          className="input"
          placeholder="Nova lista — ex.: Terror para sexta"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="check check--sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          <span>Pública</span>
        </label>
        <button className="btn btn--primary btn--sm" disabled={!name.trim() || busy === 'new'}>
          Criar
        </button>
      </form>
      <ul className="list-picker">
        {lists === null && <li className="dim">Carregando suas listas…</li>}
        {lists?.length === 0 && <li className="dim">Você ainda não tem listas. Crie a primeira acima.</li>}
        {lists?.map((l) => (
          <li key={l.id}>
            <button className={`list-picker__item ${l.has_title ? 'is-on' : ''}`} onClick={() => toggle(l)} disabled={busy === l.id} aria-pressed={!!l.has_title}>
              <span className="list-picker__check">
                <Icon name={l.has_title ? 'check' : 'plus'} size={16} />
              </span>
              <span className="list-picker__name">{l.name}</span>
              <span className="dim mono">{l.count}</span>
              <Icon name={l.is_public ? 'globe' : 'lock'} size={14} className="dim" />
            </button>
          </li>
        ))}
      </ul>
      <p className="dim" style={{ marginTop: 12, fontSize: 'var(--t-sm)' }}>
        Gerencie tudo no seu <Link to="/listas" className="link">perfil → listas</Link>.
      </p>
    </Modal>
  )
}
