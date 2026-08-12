import { zValidator } from '@hono/zod-validator'
import { failWith, notFound, sendOk } from '../../../../http.ts'
import { parsePageQuery } from '../../../../paging.ts'
import type { EventWindow } from '../../../../services/conversation/index.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { StartConversationBody } from '../../schema/index.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import { toWireEvent } from '../../wire.ts'

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
    const worker = await app.$worker.getForWorkspace(currentApp.workspaceId, input.workerId)
    if (!worker) return failWith(c, 404, 'worker_not_found', 'worker not found')
    if (!worker.online) return failWith(c, 409, 'worker_offline', 'worker is offline')

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
      providerId: worker.providerId,
      workerId: worker.id,
      defaultModel: worker.defaultModel,
      text: input.text,
      attachments: resolved.attachments,
      ...(input.model === undefined ? {} : { model: input.model }),
      ...(input.effort === undefined ? {} : { effort: input.effort }),
    })
    app.$commands.publish(worker.id, { type: 'work_available' })
    const { cid, title, lastActiveAt } = conversation
    return sendOk(c, { cid, title, lastActiveAt })
  })

  // A window of the transcript: the most recent `limit`, or the stretch before a
  // sequence, or everything after one the caller already holds. Paired with
  // `pending`, because what has been typed but not sent is part of what the
  // interface has to show and is deliberately not in the log.
  app.get('/:cid/events', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const found = await app.$conversation.getByCid(currentApp.id, c.req.param('cid'))
    if (!found) return notFound(c, 'conversation not found')

    const [events, pending, execution, worker, provider] = await Promise.all([
      app.$conversation.events(found.id, windowFrom(c.req.query())),
      app.$pendingInput.list(found.id),
      app.$turn.execution(found.id),
      found.workerId === null
        ? Promise.resolve(null)
        : app.$worker.getForWorkspace(currentApp.workspaceId, found.workerId),
      app.$provider.get(found.providerId),
    ])

    return sendOk(c, {
      items: events.map(stored => ({
        id: stored.id,
        sequence: stored.sequence,
        createdAt: stored.createdAt,
        event: toWireEvent(stored.event),
      })),
      pending,
      execution,
      assignment: {
        providerId: found.providerId,
        worker: worker
          ? {
              id: worker.id,
              name: worker.name,
              hostname: worker.hostname,
              online: worker.online,
            }
          : null,
      },
      modelConfiguration: {
        kind: provider?.kind ?? null,
        defaultModel: provider?.config.model ?? null,
        models: provider?.config.models ?? [],
        efforts: provider?.config.efforts ?? {},
        model: found.model,
        effort: found.effort,
      },
    })
  })
}
