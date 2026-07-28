import type { ApiResponse } from '@idea/shared'

// Vite proxies this prefix to the server in dev; a reverse proxy does the same
// in production. Nothing else in the app spells out a backend address.
//
// The path includes /web because the server groups its surface by client type —
// the worker daemon will talk to /api/worker with a different auth scheme.
const BASE = '/api/web'

export class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

// Unwraps the envelope so callers work in domain values, not transport shapes.
// Both failure modes — a non-2xx response and a `success: false` body — arrive
// as the same RequestError, so callers need one catch, not two branches.
const send = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new RequestError('bad_response', `${res.status} ${res.statusText}`)
  // `success` is the envelope's discriminant, so testing it narrows the union on
  // its own — a guard function would only wrap what the compiler already does.
  if (!body.success) throw new RequestError(body.code, body.message)
  return body.data
}

export const get = <T>(path: string): Promise<T> => send<T>(path)

export const post = <T>(path: string, body?: unknown): Promise<T> =>
  send<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

export const patch = <T>(path: string, body: unknown): Promise<T> =>
  send<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const del = <T>(path: string): Promise<T> => send<T>(path, { method: 'DELETE' })

// An expired session is the normal way a long-open tab discovers it is logged
// out — worth distinguishing from a real error so the UI can redirect instead of
// showing an alarming message.
export const isUnauthorized = (err: unknown): boolean =>
  err instanceof RequestError && err.code === 'unauthorized'
