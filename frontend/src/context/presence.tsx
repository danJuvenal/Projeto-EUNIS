// Presença em tempo real. Uma conexão WebSocket por aba (visitantes também recebem a lista,
// mas só quem está logado aparece). Heartbeat a cada 25 s; reconexão com backoff.
// O cliente informa só o TIPO de atividade e um id — o texto é montado pelo servidor.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { PresenceUser } from '../lib/types'
import { useAuth } from './auth'

interface PresenceState {
  users: PresenceUser[]
  count: number
  connected: boolean
  isOnline: (userId: number) => boolean
  /** Sobrepõe a atividade derivada da rota (ex.: escrevendo uma crítica). */
  setOverride: (a: Activity | null) => void
}

type Activity = { kind: string; title_id?: number; genre?: string }

const Ctx = createContext<PresenceState>({
  users: [],
  count: 0,
  connected: false,
  isOnline: () => false,
  setOverride: () => {},
})

const BEAT_MS = 25_000

function activityFromPath(pathname: string, search: string): Activity {
  const title = pathname.match(/^\/titulo\/(\d+)/)
  if (title) return { kind: 'title', title_id: Number(title[1]) }
  if (pathname.startsWith('/explorar')) {
    const genre = new URLSearchParams(search).get('genero') ?? undefined
    return { kind: 'explore', genre }
  }
  if (pathname === '/') return { kind: 'home' }
  if (pathname.startsWith('/feed')) return { kind: 'feed' }
  if (pathname.startsWith('/comunidade')) return { kind: 'community' }
  if (pathname.startsWith('/match')) return { kind: 'match' }
  if (pathname.startsWith('/u/')) return { kind: 'profile' }
  if (pathname.startsWith('/listas')) return { kind: 'lists' }
  if (pathname.startsWith('/configuracoes') || pathname.startsWith('/boas-vindas')) return { kind: 'settings' }
  return { kind: 'browsing' }
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(false)
  const [override, setOverride] = useState<Activity | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const activity = useMemo(
    () => override ?? activityFromPath(location.pathname, location.search),
    [override, location.pathname, location.search],
  )
  const activityRef = useRef(activity)
  activityRef.current = activity

  const send = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'beat', activity: activityRef.current }))
    }
  }, [])

  // (Re)conecta quando a identidade muda — a identidade vem do cookie, lido no handshake.
  useEffect(() => {
    if (!ready || typeof WebSocket === 'undefined') return
    let stopped = false
    let retry = 0
    let beat: ReturnType<typeof setInterval> | undefined
    let reconnect: ReturnType<typeof setTimeout> | undefined

    const open = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/api/ws/presence`)
      wsRef.current = ws
      ws.onopen = () => {
        retry = 0
        setConnected(true)
        send()
        beat = setInterval(send, BEAT_MS)
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'presence') setUsers(msg.users)
        } catch {
          /* ignora mensagens malformadas */
        }
      }
      ws.onclose = () => {
        clearInterval(beat)
        setConnected(false)
        if (stopped) return
        retry = Math.min(retry + 1, 6)
        reconnect = setTimeout(open, 1000 * 2 ** retry)
      }
    }
    open()

    // Ao voltar para a aba, reporta na hora (alguns navegadores atrasam timers em segundo plano)
    const onVisible = () => document.visibilityState === 'visible' && send()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      clearInterval(beat)
      clearTimeout(reconnect)
      document.removeEventListener('visibilitychange', onVisible)
      wsRef.current?.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id])

  // Atividade mudou → avisa já, sem esperar o próximo heartbeat
  useEffect(() => {
    send()
  }, [activity, send])

  const value = useMemo<PresenceState>(() => {
    const ids = new Set(users.map((u) => u.user.id))
    return { users, count: users.length, connected, isOnline: (id) => ids.has(id), setOverride }
  }, [users, connected])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePresence = () => useContext(Ctx)
