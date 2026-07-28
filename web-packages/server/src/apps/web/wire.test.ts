import type { ConversationEvent, ConversationEventType } from '@idea/shared'
import { describe, expect, it } from 'vitest'
import { toWireEvent } from './wire.ts'

const SECRET = { ANTHROPIC_API_KEY: 'sk-should-never-leave-the-server' }

// Typed as a total map, so adding a variant to ConversationEvent without adding
// a sample here fails to compile. That is what keeps the leak test below
// exhaustive as the protocol grows — a reviewer noticing is not a mechanism.
const SAMPLES: Record<ConversationEventType, ConversationEvent> = {
  user_message: { type: 'user_message', text: 'hi', model: 'glm-5.2', raw: SECRET },
  'thread.started': { type: 'thread.started', providerSessionId: 'p1', raw: SECRET },
  'turn.started': { type: 'turn.started', sourceSequence: 3, raw: SECRET },
  'item.started': {
    type: 'item.started',
    item: { id: 'i1', status: 'in_progress', type: 'agent_message', text: 'a' },
    raw: SECRET,
  },
  'item.updated': {
    type: 'item.updated',
    item: { id: 'i1', status: 'in_progress', type: 'agent_message', text: 'ab' },
    raw: SECRET,
  },
  'item.completed': {
    type: 'item.completed',
    item: { id: 'i1', status: 'completed', type: 'agent_message', text: 'abc' },
    raw: SECRET,
  },
  'turn.completed': { type: 'turn.completed', usage: { outputTokens: 7 }, raw: SECRET },
  'turn.failed': { type: 'turn.failed', error: { message: 'boom' }, raw: SECRET },
  'turn.aborted': { type: 'turn.aborted', reason: 'interrupted', raw: SECRET },
  'turn.heartbeat': { type: 'turn.heartbeat', raw: SECRET },
  system: { type: 'system', action: 'provider_retry', raw: SECRET },
  error: { type: 'error', message: 'nope', raw: SECRET },
  raw: { type: 'raw', raw: SECRET },
}

describe('the wire boundary', () => {
  // `raw` carries whatever the provider sent — an environment dump, a credential
  // passed as a tool argument, a file's contents. It exists to make an adapter
  // debuggable server-side and must not reach a browser, where it would land in
  // any DOM dump or screenshot.
  it.each(Object.keys(SAMPLES) as ConversationEventType[])('drops raw from %s', type => {
    const wire = toWireEvent(SAMPLES[type]) as Record<string, unknown>

    expect(wire).not.toHaveProperty('raw')
    expect(JSON.stringify(wire)).not.toContain('sk-should-never-leave')
  })

  it('keeps the payload the interface actually renders', () => {
    expect(toWireEvent(SAMPLES.user_message)).toEqual({
      type: 'user_message',
      text: 'hi',
      model: 'glm-5.2',
    })
  })

  // An unmapped provider event still happened. Reporting it as a system note
  // beats dropping it silently or showing the user an error that is really ours.
  it('reports an unmapped event as a system note', () => {
    expect(toWireEvent(SAMPLES.raw)).toEqual({ type: 'system', action: 'unmapped_provider_event' })
  })
})
