import { badRequest, failWith, notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { SendMessageBody } from '../../schema/index.ts'
import { isResponse, scopedConversation } from './scoped.ts'

// Saying something, and taking it back before it goes.
export const registerMessages: Controller = app => {
  // Typed, not yet sent. It becomes a message the moment nothing is running; if
  // a turn is in flight it waits and merges with whatever else arrives before
  // that turn ends, so a thought delivered in three bursts gets one considered
  // reply rather than three partial ones.
  app.post('/:cid/messages', async c => {
    const found = await scopedConversation(app, c, c.req.param('cid'))
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const body = await c.req.json().catch(() => null)
    const parsed = SendMessageBody.safeParse(body)
    if (!parsed.success) return badRequest(c, 'a message needs text or an attachment')

    const resolved = await app.$file.resolveAttachments(found.appId, parsed.data.attachmentFids)
    if (resolved.kind === 'not_found') {
      return failWith(c, 404, 'attachment_not_found', 'attachment not found')
    }
    if (resolved.kind === 'not_ready') {
      return failWith(c, 409, 'attachment_not_ready', 'attachment upload is not ready')
    }

    const pending = await app.$pendingInput.enqueue(found.id, {
      text: parsed.data.text,
      attachments: resolved.attachments,
    })
    const started = await app.$pendingInput.materialize(found.id)

    // Only worth waking anyone if a turn actually appeared. The command names no
    // turn: by the time it lands another worker may hold it, and the claim is
    // what decides.
    if (started) app.$commands.broadcast({ type: 'work_available' })

    return sendOk(c, { pending, started: started !== null })
  })

  // Possible only because what has been typed is kept out of the transcript.
  // Once something is history it stays — editing it would make the log a
  // record of what someone currently wishes they had said.
  app.delete('/:cid/pending/:inputId', async c => {
    const found = await scopedConversation(app, c, c.req.param('cid'))
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    const inputId = Number(c.req.param('inputId'))
    return sendOk(c, { cancelled: await app.$pendingInput.cancel(found.id, inputId) })
  })
}
