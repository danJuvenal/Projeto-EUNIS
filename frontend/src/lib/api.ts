// Cliente da API. Mesma origem (proxy do Vite em dev): o cookie de sessão HttpOnly vai sozinho.
// Nenhum segredo vive no frontend.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? ''

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function api<T>(path: string, { method = 'GET', body, signal }: Options = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'Sem conexão com o servidor do EUNIS. Ele está rodando?')
  }
  if (res.status === 204) return undefined as T
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* corpo vazio ou não-JSON */
  }
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : res.status >= 500
          ? 'Algo deu errado do nosso lado. Tente de novo.'
          : 'Não foi possível concluir.'
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') s.set(k, String(v))
  }
  const str = s.toString()
  return str ? `?${str}` : ''
}
