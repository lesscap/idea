import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { HealthService } from '../services/health.ts'
import type { WebApplication } from '../types.ts'
import { HealthController } from './health.ts'

// A controller only ever touches the slice of the application it uses, so a
// stub service is enough to exercise it — no database, no boot, no HTTP server.
// If this test ever needs more than a stub, the controller has grown a
// dependency it should not have.
const mountWith = (health: HealthService): Hono => {
  const app = Object.assign(new Hono(), { health }) as WebApplication
  HealthController(app)
  return app
}

describe('HealthController', () => {
  it('reports the health check result in the response envelope', async () => {
    const app = mountWith({ check: async () => ({ ok: true, db: 'up' }) })

    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { ok: true, db: 'up' } })
  })

  it('surfaces a dead database without failing the request', async () => {
    const app = mountWith({ check: async () => ({ ok: true, db: 'down' }) })

    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { ok: true, db: 'down' } })
  })
})
