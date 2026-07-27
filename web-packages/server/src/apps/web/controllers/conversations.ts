import { zValidator } from '@hono/zod-validator'
import { toWireEvent } from '@idea/shared'
import type { Context } from 'hono'
import { notFound, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { isResponse, requireCurrentWorkspace } from '../middleware/workspace.ts'
import { CreateConversationBody, IdParam, SendMessageBody } from '../schema/index.ts'

// Conversations, scoped to the workspace selected in the session like everything
// else on this surface.
//
// Every event leaving here goes through toWireEvent, which drops the provider's
// `raw` payload. That field is kept server-side to make an adapter debuggable
// and can contain an environment dump or a credential passed as a tool argument
// — the interface renders only the normalised shape, so sending it would be a
// leak with no upside.
export const ConversationsController: Controller = app => {
  // Loads a conversation only if the caller's current workspace owns it.
  // Reported as missing rather than forbidden: a 403 would confirm the id
  // exists, which is enough to enumerate other workspaces' conversations.
  const scoped = async (c: Context, id: number) => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access
    const conversation = await app.$conversation.get(id)
    return conversation && conversation.workspaceId === access.workspaceId ? conversation : null
  }

  app.get('/', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access
    return sendOk(c, { items: await app.$conversation.listForWorkspace(access.workspaceId) })
  })

  app.post('/', zValidator('json', CreateConversationBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    return sendOk(
      c,
      await app.$conversation.create({
        workspaceId: access.workspaceId,
        appId: c.req.valid('json').appId ?? null,
        createdById: session(c).userId,
      }),
    )
  })

  app.get('/:id/events', zValidator('param', IdParam), async c => {
    const found = await scoped(c, c.req.valid('param').id)
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const after = c.req.query('after')
    const events = await app.$conversation.events(
      found.id,
      after === undefined ? undefined : Number(after),
    )

    return sendOk(c, {
      items: events.map(stored => ({
        id: stored.id,
        sequence: stored.sequence,
        createdAt: stored.createdAt,
        event: toWireEvent(stored.event),
      })),
      pending: await app.$pendingInput.list(found.id),
    })
  })

  // Typed, not yet sent. It becomes a message the moment nothing is running —
  // and if a turn is in flight, it waits and merges with whatever else arrives
  // before that turn ends, so a thought delivered in three bursts gets one
  // considered reply.
  app.post('/:id/messages', zValidator('param', IdParam), async c => {
    const found = await scoped(c, c.req.valid('param').id)
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const { text } = await c.req.json<{ text: string }>().catch(() => ({ text: '' }))
    const parsed = SendMessageBody.safeParse({ text })
    if (!parsed.success) return notFound(c, 'message text required')

    const pending = await app.$pendingInput.enqueue(found.id, { text: parsed.data.text })
    const started = await app.$pendingInput.materialize(found.id)

    // Only worth waking anyone if a turn actually appeared. The command carries
    // no turn id: by the time it lands another worker may hold it, and the claim
    // is what decides.
    if (started) app.$commands.broadcast({ type: 'work_available' })

    return sendOk(c, { pending, started: started !== null })
  })

  // Withdrawing something not yet sent. Possible only because pending input is
  // kept apart from the transcript — once it is history, it stays.
  app.delete('/:id/pending/:inputId', zValidator('param', IdParam), async c => {
    const found = await scoped(c, c.req.valid('param').id)
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const inputId = Number(c.req.param('inputId'))
    return sendOk(c, { cancelled: await app.$pendingInput.cancel(found.id, inputId) })
  })
}
