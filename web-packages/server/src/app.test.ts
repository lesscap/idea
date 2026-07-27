import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app.ts'
import type { ServiceApplication } from './types.ts'

// createApp only needs whatever the mounted controllers touch. Building this by
// hand (rather than booting a real context) is the point of wiring services
// explicitly — no database is involved in testing the HTTP surface.
const services = {
  health: { check: async () => ({ ok: true, db: 'up' as const }) },
} as unknown as ServiceApplication

// The envelope is only a standard if it has no exits. These two paths are the
// ones the framework answers on its own, so they are where an inconsistent
// response would appear first.
describe('createApp fallbacks', () => {
  it('answers an unmatched route with the envelope, not framework text', async () => {
    const res = await createApp(services).request('/no-such-route')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({
      success: false,
      code: 'not_found',
      message: 'no route for GET /no-such-route',
    })
  })

  it('answers a thrown handler error with the envelope and leaks no detail', async () => {
    const app = createApp(services)
    app.get('/boom', () => {
      throw new Error('connection string: postgres://user:hunter2@host/db')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await app.request('/boom')
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ success: false, code: 'internal', message: 'internal error' })
    // The secret must reach the log and nothing else.
    expect(JSON.stringify(body)).not.toContain('hunter2')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('still routes mounted controllers', async () => {
    const res = await createApp(services).request('/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { ok: true, db: 'up' } })
  })
})
