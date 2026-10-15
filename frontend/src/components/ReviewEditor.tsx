import { useEffect, useState } from 'react'
import { usePresence } from '../context/presence'
import { useToast } from '../context/toast'
import { api } from '../lib/api'
import type { Review } from '../lib/types'
import { Modal } from './Modal'
import { StarInput } from './Rating'

/** Criar/editar a própria crítica. Uma por título (o backend garante). */
export function ReviewEditor({
  open,
  onClose,
  titleId,
  titleName,
  existing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  titleId: number
  titleName: string
  existing: Review | null
  onSaved: (r: Review) => void
}) {
  const toast = useToast()
  const { setOverride } = usePresence()
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null)
  const [body, setBody] = useState(existing?.body ?? '')
  const [spoilers, setSpoilers] = useState(existing?.spoilers ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? null)
      setBody(existing?.body ?? '')
      setSpoilers(existing?.spoilers ?? false)
      setError(null)
      setOverride({ kind: 'review', title_id: titleId })
    }
    return () => setOverride(null)
  }, [open, existing, titleId, setOverride])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating == null && !body.trim()) {
      setError('Dê uma nota ou escreva algumas palavras.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const r = await api<Review>(`/api/titles/${titleId}/review`, {
        method: 'PUT',
        body: { rating, body, spoilers },
      })
      toast(existing?.body ? 'Crítica atualizada' : 'Crítica publicada', { tone: 'success' })
      onSaved(r)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing?.body ? 'Editar crítica' : 'Sua crítica'}>
      <form onSubmit={save} className="form">
        <p className="muted">
          Sobre <strong className="text">{titleName}</strong>
        </p>
        <div className="field">
          <span className="field__label">Nota</span>
          <StarInput value={rating} onChange={setRating} size={36} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="review-body">
            Crítica <span className="dim">(opcional)</span>
          </label>
          <textarea
            id="review-body"
            className="input textarea"
            rows={6}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="O que ficou com você depois dos créditos?"
          />
          <span className="field__hint dim mono">{body.length}/5000</span>
        </div>
        <label className="check">
          <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
          <span>Contém spoilers</span>
        </label>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" disabled={saving}>
            {saving ? 'Salvando…' : existing?.body ? 'Salvar alterações' : 'Publicar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
