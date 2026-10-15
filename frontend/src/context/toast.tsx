import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

type Tone = 'default' | 'success' | 'error'
interface Toast {
  id: number
  text: string
  tone: Tone
  action?: { label: string; to: string }
}

const Ctx = createContext<(text: string, opts?: { tone?: Tone; action?: Toast['action'] }) => void>(() => {})

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((text: string, opts: { tone?: Tone; action?: Toast['action'] } = {}) => {
    const id = ++seq
    setToasts((t) => [...t.slice(-2), { id, text, tone: opts.tone ?? 'default', action: opts.action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span>{t.text}</span>
            {t.action && (
              <Link to={t.action.to} className="toast__action">
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
