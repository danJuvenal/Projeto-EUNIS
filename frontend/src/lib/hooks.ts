import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

export interface Query<T> {
  data: T | null
  error: Error | null
  loading: boolean
  reload: () => void
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/** GET simples com cancelamento. `path = null` não busca nada. */
export function useApi<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null) {
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api<T>(path, { signal: ctrl.signal })
      .then((d) => setData(d))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [path, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload, setData }
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Atualiza o <title> da página. */
export function useDocumentTitle(title: string | null | undefined) {
  const prev = useRef(document.title)
  useEffect(() => {
    const before = prev.current
    if (title) document.title = `${title} · EUNIS`
    return () => {
      document.title = before
    }
  }, [title])
}
