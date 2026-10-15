import { useEffect, useState } from 'react'
import { api } from './api'
import type { GenreRef } from './types'

// Dados quase estáticos, buscados uma vez por sessão.
let statusP: Promise<'demo' | 'tmdb'> | null = null
let genresP: Promise<GenreRef[]> | null = null

export function useCatalogSource(): 'demo' | 'tmdb' | null {
  const [s, setS] = useState<'demo' | 'tmdb' | null>(null)
  useEffect(() => {
    statusP ??= api<{ source: 'demo' | 'tmdb' }>('/api/catalog/status').then((r) => r.source)
    statusP.then(setS).catch(() => {
      statusP = null
    })
  }, [])
  return s
}

export function useGenres(): GenreRef[] {
  const [g, setG] = useState<GenreRef[]>([])
  useEffect(() => {
    genresP ??= api<GenreRef[]>('/api/genres').then((gs) => [...gs].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    genresP.then(setG).catch(() => {
      genresP = null
    })
  }, [])
  return g
}
