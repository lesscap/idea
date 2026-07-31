import { zValidator } from '@hono/zod-validator'
import { failWith, notFound, sendOk } from '../../../../http.ts'
import { parsePageQuery } from '../../../../paging.ts'
import type { EventWindow } from '../../../../services/conversation/index.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { StartConversationBody } from '../../schema/index.ts'
import { toWireEvent } from '../../wire.ts'
import { isResponse, scopedApp, scopedConversation } from './scoped.ts'

// Beyond this a transcript read stops being a window. Nothing in the interface
// asks for more; a caller that does gets the ceiling rather than an error.
const MAX_WINDOW = 1000

const wholeNumber = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

// `limit` is clamped rather than rejected, for the reason parsePageQuery clamps
// pageSize: it becomes a SQL LIMIT, so leaving it open is a full-table read for
// the asking. Unreadable values fall away instead of failing the request — a
// transcript that will not open is worse than one that opens wider than asked.
const windowFrom = (query: Record<string, string | undefined>): EventWindow => {
  const after = wholeNumber(query.after)
  const before = wholeNumber(query.before)
  const limit = wholeNumber(query.limit)
  return {
    ...(after === undefined ? {} : { after }),
    ...(before === undefined ? {} : { before }),
    ...(limit === undefined ? {} : { limit: Math.min(Math.max(limit, 1), MAX_WINDOW) }),
  }
}

// The conversation as a resource: list it, start one, read what was said.
export const registerRead: Controller = app => {
  app.get('/', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const query = parsePageQuery(c.req.query())
    const page = await app.$conversation.listForApp(currentApp.id, query)
    return sendOk(c, {
      ...page,
      items: page.items.map(({ cid, title, lastActiveAt }) => ({ cid, title, lastActiveAt })),
    })
  })

  // Creation and the first message are one operation. A click on "new" is only
  // a draft in the browser; persisting before anyone says anything leaves empty
  // conversations in the list, while separate create/send requests can leave
  // one behind when only the second fails.
  app.post('/', zValidator('json', StartConversationBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const input = c.req.valid('json')
    const resolved = await app.$file.resolveAttachments(currentApp.id, input.attachmentFids)
    if (resolved.kind === 'not_found') {
      return failWith(c, 404, 'attachment_not_found', 'attachment not found')
    }
    if (resolved.kind === 'not_ready') {
      return failWith(c, 409, 'attachment_not_ready', 'attachment upload is not ready')
    }

    const conversation = await app.$conversation.start({
      appId: currentApp.id,
      createdById: session(c).userId,
      text: input.text,
      attachments: resolved.attachments,
    })
    app.$commands.broadcast({ type: 'work_available' })
    const { cid, title, lastActiveAt } = conversation
    return sendOk(c, { cid, title, lastActiveAt })
  })

  // A window of the transcript: the most recent `limit`, or the stretch before a
  // sequence, or everything after one the caller already holds. Paired with
  // `pending`, because what has been typed but not sent is part of what the
  // interface has to show and is deliberately not in the log.
  app.get('/:cid/events', async c => {
    const found = await scopedConversation(app, c, c.req.param('cid'))
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const events = await app.$conversation.events(found.id, windowFrom(c.req.query()))

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
