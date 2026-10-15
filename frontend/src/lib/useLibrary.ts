import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api } from './api'
import type { LibraryState } from './types'

const EMPTY: LibraryState = { watchlist: false, watched: false, favorite: false, watched_at: null }

const MESSAGES: Record<string, [string, string]> = {
  watchlist: ['Na sua lista de quero ver', 'Saiu do quero ver'],
  watched: ['Marcado como assistido', 'Desmarcado como assistido'],
  favorite: ['Adicionado aos favoritos', 'Removido dos favoritos'],
}

/** Estado pessoal de um título com atualização otimista. Visitante vai para o login. */
export function useLibrary(titleId: number, initial?: LibraryState | null) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<LibraryState>(initial ?? EMPTY)
  const [busy, setBusy] = useState(false)

  const requireLogin = useCallback(() => {
    if (user) return false
    navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`)
    return true
  }, [user, navigate, location])

  const toggle = useCallback(
    async (field: 'watchlist' | 'watched' | 'favorite', value?: boolean) => {
      if (requireLogin()) return
      const next = value ?? !state[field]
      const before = state
      setState((s) => ({ ...s, [field]: next, ...(field === 'watched' && next ? { watchlist: false } : {}) }))
      setBusy(true)
      try {
        const res = await api<LibraryState>(`/api/titles/${titleId}/library`, { method: 'PUT', body: { [field]: next } })
        setState(res)
        toast(MESSAGES[field][next ? 0 : 1], {
          tone: next ? 'success' : 'default',
          action: next && user ? { label: 'Ver perfil', to: `/u/${user.username}` } : undefined,
        })
      } catch (e) {
        setState(before)
        toast((e as Error).message, { tone: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [state, titleId, toast, requireLogin, user],
  )

  return { state, setState, toggle, busy, requireLogin }
}
