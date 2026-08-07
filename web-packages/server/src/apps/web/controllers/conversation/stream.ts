import type { StoredEvent } from '@idea/shared'
import { notFound } from '../../../../http.ts'
import { streamBus } from '../../../../sse.ts'
import type { Controller } from '../../../../types.ts'
import { scopedConversation } from '../../services/scope/conversation.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import { toWireEvent } from '../../wire.ts'

// The live tail of a conversation. History is not here — it comes from
// `/events`, which already takes `?after=` — so this stream holds no cursor and
// no replay buffer.
//
// The split is what makes reconnecting simple: the client opens the tail first
// and only then reads the gap, so anything arriving in between is delivered by
// the tail and deduplicated by id rather than falling between the two.
export const registerStream: Controller = app => {
  app.get('/:cid/stream', async c => {
    const found = await scopedConversation(app, c, c.req.param('cid'))
    if (isResponse(found)) return found
    if (!found) return notFound(c, 'conversation not found')

    // Projected on the way out. `raw` holds the provider's untouched payload,
    // which can carry an environment dump or a credential passed as a tool
    // argument, and has no use in a browser.
    return streamBus<StoredEvent>(
      c,
      push => app.$events.subscribe(found.id, push),
      stored =>
        JSON.stringify({
          id: stored.id,
          sequence: stored.sequence,
          createdAt: stored.createdAt,
          event: toWireEvent(stored.event),
        }),
    )
  })
}
