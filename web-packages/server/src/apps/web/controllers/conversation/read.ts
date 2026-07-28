import { zValidator } from '@hono/zod-validator'
import { toWireEvent } from '@idea/shared'
import { notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { isResponse, requireCurrentWorkspace } from '../../middleware/workspace.ts'
import { IdParam, StartConversationBody } from '../../schema/index.ts'
import { scopedConversation } from './scoped.ts'

// The conversation as a resource: list it, start one, read what was said.
export const registerRead: Controller = app => {
  app.get('/', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access
    return sendOk(c, { items: await app.$conversation.listForWorkspace(access.workspaceId) })
  })

  // Creation and the first message are one operation. A click on "new" is only
  // a draft in the browser; persisting before anyone says anything leaves empty
  // conversations in the list, while separate create/send requests can leave
  // one behind when only the second fails.
  app.post('/', zValidator('json', StartConversationBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const conversation = await app.$conversation.start({
      workspaceId: access.workspaceId,
      createdById: session(c).userId,
      text: c.req.valid('json').text,
    })
    app.$commands.broadcast({ type: 'work_available' })
    return sendOk(c, conversation)
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
