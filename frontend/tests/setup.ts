import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom não implementa estas APIs de navegador usadas pela interface
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    // Testes rodam como "movimento reduzido": GSAP não anima, conteúdo aparece direto
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
// @ts-expect-error mock mínimo
window.IntersectionObserver = IO
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
// Presença em tempo real fica desligada nos testes de componente
// @ts-expect-error remover WebSocket do jsdom
delete globalThis.WebSocket

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
