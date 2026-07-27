import { zValidator } from '@hono/zod-validator'
import type { ConversationEvent } from '@idea/shared'
import { badRequest, notFound, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { currentWorker } from '../middleware/auth.ts'
import { AppendEventBody, ClaimTurnParams, FinishTurnBody } from '../schema/index.ts'

// What a worker does with a turn: take it, read the conversation so far, write
// what happens, and close it.
//
// Every route re-reads which worker is calling from its token rather than
// trusting an id in the body — a worker may only touch what it actually holds.
export const TurnsController: Controller = app => {
  const holds = async (turnId: number, workerId: number) => {
    const turn = await app.$prisma.turn.findUnique({
      where: { id: turnId },
      select: { workerId: true, conversationId: true },
    })
    return turn?.workerId === workerId ? turn : null
  }

  // Returns the next turn this worker may run, or nothing. Which turn is not
  // negotiable from the client side: the claim is a conditional write, and
  // losing it is the ordinary outcome rather than an error.
  app.post('/claim', async c => {
    const worker = currentWorker(c)
    const claimed = await app.$turn.claimNext(worker)
    if (!claimed) return sendOk(c, { turn: null })

    const conversation = await app.$conversation.get(claimed.conversationId)
    return sendOk(c, { turn: claimed, conversation })
  })

  // The transcript so far, so a worker can rebuild context after a restart.
  // `after` is exclusive, so a worker resuming passes the last sequence it saw.
  app.get('/:id/events', zValidator('param', ClaimTurnParams), async c => {
    const worker = currentWorker(c)
    const { id } = c.req.valid('param')
    const turn = await holds(id, worker.id)
    if (!turn) return notFound(c, 'turn not found')

    const after = c.req.query('after')
    const events = await app.$conversation.events(
      turn.conversationId,
      after === undefined ? undefined : Number(after),
    )
    return sendOk(c, { items: events })
  })

  // Writes one canonical event. The worker has already normalised whatever its
  // provider produced — the server stores the result, including `raw`, and
  // strips that on the way out to a browser.
  app.post('/:id/events', zValidator('param', ClaimTurnParams), async c => {
    const worker = currentWorker(c)
    const { id } = c.req.valid('param')
    const turn = await holds(id, worker.id)
    if (!turn) return notFound(c, 'turn not found')

    const body = await c.req.json().catch(() => null)
    const parsed = AppendEventBody.safeParse(body)
    if (!parsed.success) return badRequest(c, 'event must have a type')

    // A heartbeat renews the lease and is not worth a transcript row: a long
    // tool call would otherwise fill the log with them. Without the renewal the
    // reaper would take the turn away mid-work and run it a second time.
    if (parsed.data.type === 'turn.heartbeat') {
      const renewed = await app.$turn.renewLease(id, worker.id)
      return sendOk(c, { renewed })
    }

    const stored = await app.$conversation.appendEvent(
      turn.conversationId,
      parsed.data as ConversationEvent,
    )
    return sendOk(c, { sequence: stored.sequence })
  })

  // Closing is the worker's move, not the server's, even for an abort: only the
  // worker knows whether it stopped cleanly, and the transcript's last event
  // should say what actually happened.
  app.post('/:id/finish', zValidator('param', ClaimTurnParams), async c => {
    const worker = currentWorker(c)
    const { id } = c.req.valid('param')
    if (!(await holds(id, worker.id))) return notFound(c, 'turn not found')

    const body = await c.req.json().catch(() => null)
    const parsed = FinishTurnBody.safeParse(body)
    if (!parsed.success) return badRequest(c, 'outcome must be completed, failed or aborted')

    return sendOk(c, { finished: await app.$turn.finish(id, parsed.data.outcome) })
  })
}
