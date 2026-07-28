import { zValidator } from '@hono/zod-validator'
import { toWireEvent } from '@idea/shared'
import { notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { isResponse, requireCurrentWorkspace } from '../../middleware/workspace.ts'
import { CreateConversationBody, IdParam } from '../../schema/index.ts'
import { scopedConversation } from './scoped.ts'

// The conversation as a resource: list it, start one, read what was said.
export const registerRead: Controller = app => {
  app.get('/', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access
    return sendOk(c, { items: await app.$conversation.listForWorkspace(access.workspaceId) })
  })

  // No backend is chosen here. Whichever worker claims the first turn decides,
  // and the conversation is fixed to it from then on — so starting one needs no
  // decision from anybody.
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

  // The whole transcript, or just what came after a sequence the caller already
  // holds. Paired with `pending`, because what has been typed but not sent is
  // part of what the interface has to show and is deliberately not in the log.
  app.get('/:id/events', zValidator('param', IdParam), async c => {
    const found = await scopedConversation(app, c, c.req.valid('param').id)
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
}
