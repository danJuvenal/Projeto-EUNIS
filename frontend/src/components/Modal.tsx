import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { Icon } from './Icon'

/** Diálogo acessível: foco preso, Esc fecha, devolve o foco ao sair. Vira "sheet" no mobile. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = panel.current
    el?.querySelector<HTMLElement>('[autofocus], input, textarea, button:not(.modal__close)')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [open, onClose])

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from(backdrop.current, { autoAlpha: 0, duration: 0.3, ease: 'power2.out' })
      gsap.from(panel.current, { y: 28, autoAlpha: 0, scale: 0.98, duration: 0.5 })
    })
    return () => ctx.revert()
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="modal" role="presentation">
      <div ref={backdrop} className="modal__backdrop" onClick={onClose} />
      <div ref={panel} className={`modal__panel ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="icon-btn modal__close" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
