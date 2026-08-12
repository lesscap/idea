import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceApplication, WebApplication } from '../../../types.ts'
import { json, okData } from '../../web/test-support.ts'
import { TurnsController } from './turns.ts'

// Closing a turn is the only moment at which input staged while it ran becomes
// sendable. Nothing else observes that moment, so the wiring here is the whole
// mechanism — and it is invisible from the service tests, which can only show
// that materialize would have worked had anyone called it.

const WORKER = { id: 7, workspaceId: 1, providerId: 1 }

const mount = (services: Partial<ServiceApplication>): Hono => {
  const app = Object.assign(new Hono(), services) as WebApplication
  // Stands in for workerAuth, which is the only thing these routes need from
  // the surrounding app: which worker is calling.
  const asWorker: MiddlewareHandler = async (c, next) => {
    c.set('worker' as never, WORKER as never)
    await next()
  }
  app.use('*', asWorker)
  TurnsController(app)
  return app
}

const services = (over: {
  finished?: boolean
  materialize?: ReturnType<typeof vi.fn>
  publish?: ReturnType<typeof vi.fn>
  abortRequested?: boolean
  turnStatus?: 'running' | 'completed'
  turnWorkerId?: number
}) =>
  ({
    $prisma: {
      turn: {
        findUnique: async () => ({
          status: over.turnStatus ?? 'running',
          conversationId: 42,
          conversation: { workerId: over.turnWorkerId ?? 7 },
        }),
      },
    },
    $turn: {
      finish: async () => over.finished ?? true,
      renewLease: async () => true,
      isAbortRequested: async () => over.abortRequested ?? false,
    },
    $conversation: { events: async () => [] },
    $pendingInput: { materialize: over.materialize ?? vi.fn().mockResolvedValue(null) },
    $commands: { publish: over.publish ?? vi.fn() },
  }) as never

describe('finishing a turn', () => {
  it('lets anything queued during the turn go out', async () => {
    const materialize = vi.fn().mockResolvedValue({ sequence: 9 })
    const publish = vi.fn()
    const app = mount(services({ materialize, publish }))

    await app.request('/1/finish', json({ outcome: 'completed' }))

    expect(materialize).toHaveBeenCalledWith(42)
    // Nobody is watching the queue; a worker only looks when told to.
    expect(publish).toHaveBeenCalledWith(WORKER.id, { type: 'work_available' })
  })

  // Losing the race is ordinary — another request may already have closed this
  // turn — and acting on a close that did not happen would start a turn while
  // one is still open.
  it('does nothing when the close was not this request', async () => {
    const materialize = vi.fn()
    const app = mount(services({ finished: false, materialize }))

    const body = await okData<{ finished: boolean }>(
      await app.request('/1/finish', json({ outcome: 'completed' })),
    )

    expect(body.finished).toBe(false)
    expect(materialize).not.toHaveBeenCalled()
  })

  // An empty queue is the common case: waking a worker for nothing costs a claim
  // round trip per finished turn.
  it('wakes nobody when there was nothing waiting', async () => {
    const publish = vi.fn()
    const app = mount(services({ publish }))

    await app.request('/1/finish', json({ outcome: 'completed' }))

    expect(publish).not.toHaveBeenCalled()
  })
})

describe('heartbeating a turn', () => {
  it('returns the durable abort request with the lease result', async () => {
    const app = mount(services({ abortRequested: true }))

    const body = await okData<{ renewed: boolean; abortRequested: boolean }>(
      await app.request('/1/events', json({ type: 'turn.heartbeat' })),
    )

    expect(body).toEqual({ renewed: true, abortRequested: true })
  })
})

describe('reading turn events', () => {
  it('lets the assigned worker read a completed turn for automatic naming', async () => {
    const response = await mount(services({ turnStatus: 'completed' })).request('/1/events')

    expect(response.status).toBe(200)
    expect(await okData<{ items: unknown[] }>(response)).toEqual({ items: [] })
  })

  it('does not expose a completed turn to another worker', async () => {
    const response = await mount(
      services({ turnStatus: 'completed', turnWorkerId: 8 }),
    ).request('/1/events')

    expect(response.status).toBe(404)
  })

  it('still rejects heartbeat writes after a turn is complete', async () => {
    const response = await mount(services({ turnStatus: 'completed' })).request(
      '/1/events',
      json({ type: 'turn.heartbeat' }),
    )

    expect(response.status).toBe(404)
  })
})
