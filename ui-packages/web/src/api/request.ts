import { type ApiResponse, isOk } from '@idea/shared'

// Vite proxies this prefix to the server in dev; a reverse proxy does the same
// in production. Nothing else in the app spells out a backend address.
const BASE = '/api'

export class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

// Unwraps the envelope so callers work in domain values, not in transport
// shapes. Both failure modes — a non-2xx response and a `success: false` body —
// arrive as the same RequestError, so callers need one catch, not two branches.
const send = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new RequestError('bad_response', `${res.status} ${res.statusText}`)
  if (!isOk(body)) throw new RequestError(body.code, body.message)
  return body.data
}

export const get = <T>(path: string): Promise<T> => send<T>(path)

export const post = <T>(path: string, body: unknown): Promise<T> =>
  send<T>(path, { method: 'POST', body: JSON.stringify(body) })
