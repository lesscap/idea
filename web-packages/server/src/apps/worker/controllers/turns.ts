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
    // The endpoint and model ride along rather than being fetched separately:
    // the server already knows which backend this worker runs, and none of it is
    // secret — the credential is named here, never carried.
    const provider = await app.$provider.get(worker.providerId)

    return sendOk(c, { turn: claimed, conversation, provider: provider?.config ?? null })
  })

  // The transcript so far, so a worker can rebuild context after a restart.
  // `after` is exclusive, so a worker resuming passes the last sequence it saw.
  app.get('/:id/events', zValidator('param', ClaimTurnParams), async c => {
    const worker = currentWorker(c)
    const { id } = c.req.valid('param')
    const turn = await holds(id, worker.id)
    if (!turn) return notFound(c, 'turn not found')

    // No window here. The worker builds the agent's context from the transcript,
    // so a truncated read would silently drop what the conversation was about.
    const after = c.req.query('after')
    const events = await app.$conversation.events(
      turn.conversationId,
      after === undefined ? {} : { after: Number(after) },
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

    const event = parsed.data as ConversationEvent
    const stored = await app.$conversation.appendEvent(turn.conversationId, event)

    // The handle the next turn resumes from. Taken from the transcript rather
    // than reported separately, because the fact is already here — and it
    // changes whenever a session could not be resumed and a new one began, so
    // recording it only once would leave later turns resuming an id that no
    // longer exists.
    if (event.type === 'thread.started' && event.providerSessionId)
      await app.$conversation.rememberSession(turn.conversationId, event.providerSessionId)

    return sendOk(c, { sequence: stored.sequence })
  })

  // Closing is the worker's move, not the server's, even for an abort: only the
  // worker knows whether it stopped cleanly, and the transcript's last event
  // should say what actually happened.
  app.post('/:id/finish', zValidator('param', ClaimTurnParams), async c => {
    const worker = currentWorker(c)
    const { id } = c.req.valid('param')
    const turn = await holds(id, worker.id)
    if (!turn) return notFound(c, 'turn not found')

    const body = await c.req.json().catch(() => null)
    const parsed = FinishTurnBody.safeParse(body)
    if (!parsed.success) return badRequest(c, 'outcome must be completed, failed or aborted')

    const finished = await app.$turn.finish(id, parsed.data.outcome)

    // Closing the turn is the moment anything typed while it ran becomes
    // sendable, and this is the only place that moment is observable. Without
    // this, input staged mid-turn waits for the person to send something else
    // before it goes anywhere — which, from their side, is a message that
    // silently never gets answered.
    if (finished) {
      const started = await app.$pendingInput.materialize(turn.conversationId)
      if (started) app.$commands.broadcast({ type: 'work_available' })
    }

    return sendOk(c, { finished })
  })
}
