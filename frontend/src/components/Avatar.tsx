import { usePresence } from '../context/presence'
import { initials } from '../lib/format'
import type { PublicUser } from '../lib/types'

type U = Pick<PublicUser, 'id' | 'name' | 'avatar_hue'>

/** Avatar com iniciais e matiz próprio. Anel verde = online agora (presença em tempo real). */
export function Avatar({ user, size = 40, ring = true }: { user: U; size?: number; ring?: boolean }) {
  const { isOnline } = usePresence()
  const online = ring && isOnline(user.id)
  const h = user.avatar_hue
  return (
    <span
      className={`avatar ${online ? 'is-online' : ''}`}
      style={
        {
          width: size,
          height: size,
          fontSize: Math.max(11, size * 0.38),
          '--h': h,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {initials(user.name)}
      {online && <span className="avatar__dot" />}
    </span>
  )
}

export function DemoTag() {
  return (
    <span className="tag tag--demo" title="Conta de demonstração criada pelo seed de desenvolvimento — não é uma pessoa real">
      demo
    </span>
  )
}
