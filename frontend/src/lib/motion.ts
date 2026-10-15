// GSAP centralizado: registro do ScrollTrigger e um hook com limpeza automática.
// Toda animação passa por gsap.context (revert no unmount) e gsap.matchMedia
// (prefers-reduced-motion e pointer: fine).
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { type DependencyList, type RefObject, useLayoutEffect } from 'react'

gsap.registerPlugin(ScrollTrigger)
gsap.defaults({ ease: 'expo.out', duration: 0.9 })

export { gsap, ScrollTrigger }

export interface MotionConditions {
  motion: boolean
  reduce: boolean
  fine: boolean
  desktop: boolean
}

type Setup = (c: MotionConditions) => void | (() => void)

export function useGsap(setup: Setup, deps: DependencyList, scope?: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mm = gsap.matchMedia(scope?.current ?? undefined)
    mm.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
        fine: '(pointer: fine)',
        desktop: '(min-width: 1024px)',
      },
      (ctx) => setup(ctx.conditions as unknown as MotionConditions),
    )
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Revelação padrão de seção: filhos com [data-reveal] sobem e aparecem uma vez. */
export function revealOnScroll(root: Element | null, { y = 28, stagger = 0.08 } = {}) {
  if (!root || prefersReducedMotion()) return
  const items = root.querySelectorAll<HTMLElement>('[data-reveal]')
  if (!items.length) return
  gsap.from(items, {
    y,
    autoAlpha: 0,
    stagger,
    duration: 1,
    scrollTrigger: { trigger: root, start: 'top 80%', once: true },
  })
}

/** Inclinação 3D sutil acompanhando o cursor (só ponteiro fino). Retorna a limpeza. */
export function tilt(el: HTMLElement, max = 6) {
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' })
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' })
  gsap.set(el, { transformPerspective: 800 })
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    ry(px * max * 2)
    rx(-py * max * 2)
  }
  const leave = () => {
    rx(0)
    ry(0)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

/** Botão "magnético": desloca alguns pixels em direção ao cursor. */
export function magnetic(el: HTMLElement, strength = 0.25) {
  const x = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
  const y = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    x((e.clientX - (r.left + r.width / 2)) * strength)
    y((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const leave = () => {
    x(0)
    y(0)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Pulso curto de feedback (curtir, salvar). */
export function pop(el: Element | null) {
  if (!el || prefersReducedMotion()) return
  gsap.fromTo(el, { scale: 0.82 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
}
