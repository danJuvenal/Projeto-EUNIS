import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Me } from '../lib/types'

interface AuthState {
  user: Me | null
  ready: boolean
  login: (email: string, password: string) => Promise<Me>
  register: (data: { name: string; username: string; email: string; password: string }) => Promise<Me>
  logout: () => Promise<void>
  update: (patch: Partial<Pick<Me, 'name' | 'bio' | 'avatar_hue' | 'show_online' | 'onboarded'>> & {
    favorite_genres?: string[]
  }) => Promise<Me>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api<{ user: Me | null }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const me = await api<Me>('/api/auth/login', { method: 'POST', body: { email, password } })
    setUser(me)
    return me
  }, [])

  const register = useCallback(async (data: { name: string; username: string; email: string; password: string }) => {
    const me = await api<Me>('/api/auth/register', { method: 'POST', body: data })
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const update = useCallback<AuthState['update']>(async (patch) => {
    const me = await api<Me>('/api/auth/me', { method: 'PATCH', body: patch })
    setUser(me)
    return me
  }, [])

  const value = useMemo(() => ({ user, ready, login, register, logout, update }), [user, ready, login, register, logout, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
