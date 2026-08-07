import type { ConversationEvent, WireEvent } from '@idea/shared'

// The outbound projection: what a stored event looks like once it has left the
// server.
//
// Lives under apps/web rather than in the conversation service because that is
// what it is about — this app's boundary, not how a transcript is kept. The
// worker reads the same events with `raw` intact.
//
// `WireEvent` itself stays in @idea/shared: the browser compiles against it, so
// it is a genuine two-sided contract. Only the projection is logic, and logic is
// what that package does not carry.

const seq = (sourceSequence?: number) => (sourceSequence === undefined ? {} : { sourceSequence })

// Reached only if a variant below was never handled — and it cannot be reached
// without failing to compile first. `event` is narrowed to `never` once every
// branch has returned, so an unhandled one arrives here as itself and has no
// business being passed to a `never` parameter.
//
// This is the whole exhaustiveness mechanism, and it is not decoration. A plain
// `throw` at the end of the chain type-checks just as happily with a variant
// missing, which would turn "someone added an event type" into a runtime
// surprise in the one function whose job is to stop `raw` from escaping.
const unhandled = (event: never): never => {
  throw new Error(`no wire projection for ${JSON.stringify(event)}`)
}

// Strip the provider payload before an event leaves the server. `raw` exists to
// make an adapter debuggable, not to be rendered — the UI reads only the
// normalised shape, so sending it is both a leak and a waste.
//
// Built by naming fields rather than by deleting one: a field that is never
// copied cannot be forgotten, so a variant added with a secret in it fails to
// compile here instead of leaking at runtime.
//
// The 'raw' variant collapses to a `system` note: a client that cannot render an
// unmapped provider event should still see that something happened.
export const toWireEvent = (event: ConversationEvent): WireEvent => {
  if (event.type === 'user_message')
    return {
      type: 'user_message',
      text: event.text,
      ...(event.attachments ? { attachments: event.attachments } : {}),
      ...(event.model ? { model: event.model } : {}),
      ...(event.effort ? { effort: event.effort } : {}),
    }

  if (event.type === 'thread.started')
    return {
      type: 'thread.started',
      providerSessionId: event.providerSessionId,
      ...(event.model ? { model: event.model } : {}),
    }

  if (event.type === 'turn.started') return { type: 'turn.started', ...seq(event.sourceSequence) }

  if (
    event.type === 'item.started' ||
    event.type === 'item.updated' ||
    event.type === 'item.completed'
  )
    return { type: event.type, item: event.item }

  if (event.type === 'turn.completed')
    return {
      type: 'turn.completed',
      ...(event.usage ? { usage: event.usage } : {}),
      ...seq(event.sourceSequence),
    }

  if (event.type === 'turn.failed')
    return {
      type: 'turn.failed',
      error: { message: event.error.message },
      ...seq(event.sourceSequence),
    }

  if (event.type === 'turn.aborted')
    return {
      type: 'turn.aborted',
      ...(event.reason ? { reason: event.reason } : {}),
      ...seq(event.sourceSequence),
    }

  if (event.type === 'turn.heartbeat') return { type: 'turn.heartbeat' }

  if (event.type === 'system')
    return {
      type: 'system',
      action: event.action,
      ...(event.message ? { message: event.message } : {}),
    }

  if (event.type === 'error') return { type: 'error', message: event.message }

  if (event.type === 'raw') return { type: 'system', action: 'unmapped_provider_event' }

  return unhandled(event)
}
