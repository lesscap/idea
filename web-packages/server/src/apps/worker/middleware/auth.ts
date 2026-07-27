import type { Context, MiddlewareHandler } from 'hono'
import { unauthorized } from '../../../http.ts'
import type { Worker } from '../../../services/worker.ts'
import type { ServiceApplication } from '../../../types.ts'

// Bearer tokens, with no cookie anywhere near them. The web surface and this one
// have no middleware in common, which is what makes "does this route require a
// session or a token" a structural fact rather than something to remember.

const WORKER_KEY = 'worker'

export const workerAuth =
  (services: ServiceApplication): MiddlewareHandler =>
  async (c, next) => {
    const header = c.req.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (token === '') return unauthorized(c, 'worker token required')

    // The service compares hashes; the plaintext never reaches storage.
    const worker = await services.$worker.byToken(token)
    if (!worker) return unauthorized(c, 'worker token required')

    c.set(WORKER_KEY, worker)
    await next()
  }

export const currentWorker = (c: Context): Worker => c.get(WORKER_KEY) as Worker
