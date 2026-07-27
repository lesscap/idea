import { describe, expect, it } from 'vitest'
import {
  agentMessageOf,
  type ConversationEvent,
  type ConversationEventType,
  isAgentWorking,
  type StoredEvent,
  toWireEvent,
} from './conversation-event.ts'

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

const log = (...events: ConversationEvent[]): StoredEvent[] =>
  events.map((event, i) => ({ id: i + 1, sequence: i, event, createdAt: '' }))

describe('isAgentWorking', () => {
  // The trap: a finished conversation is full of turn.started, so asking whether
  // any exists answers yes forever. Only the last boundary event decides.
  it('is false for a long finished conversation', () => {
    const events = log(
      { type: 'user_message', text: 'one' },
      { type: 'turn.started' },
      { type: 'turn.completed' },
      { type: 'user_message', text: 'two' },
      { type: 'turn.started' },
      { type: 'turn.completed' },
    )

    expect(isAgentWorking(events)).toBe(false)
  })

  it('is true while a turn is open', () => {
    expect(isAgentWorking(log({ type: 'user_message', text: 'x' }, { type: 'turn.started' }))).toBe(
      true,
    )
  })

  // A message with no turn yet is still work outstanding — the queue is not
  // empty just because nobody has picked it up.
  it('is true for a message nothing has started yet', () => {
    expect(isAgentWorking(log({ type: 'user_message', text: 'x' }))).toBe(true)
  })

  // Aborting closes a turn. Miss this and the interface shows a spinner that
  // never stops after someone presses stop.
  it('treats an abort as closing the turn', () => {
    const events = log(
      { type: 'user_message', text: 'x' },
      { type: 'turn.started' },
      { type: 'turn.aborted', reason: 'interrupted' },
    )

    expect(isAgentWorking(events)).toBe(false)
  })

  // Heartbeats and item frames are not boundaries; a turn full of them is still
  // whatever the last real boundary said.
  it('ignores non-boundary events', () => {
    const events = log(
      { type: 'user_message', text: 'x' },
      { type: 'turn.started' },
      { type: 'turn.heartbeat' },
      {
        type: 'item.completed',
        item: { id: 'i', status: 'completed', type: 'reasoning', text: 'r' },
      },
      { type: 'turn.completed' },
      { type: 'turn.heartbeat' },
    )

    expect(isAgentWorking(events)).toBe(false)
  })

  it('is false for an empty conversation', () => {
    expect(isAgentWorking([])).toBe(false)
  })
})

describe('agentMessageOf', () => {
  // Callers accumulate by id: item.updated replaces the earlier frame rather
  // than appending to it. Returning the id is what makes that possible.
  it('returns the item id so frames replace rather than concatenate', () => {
    const first = agentMessageOf({
      type: 'item.updated',
      item: { id: 'm1', status: 'in_progress', type: 'agent_message', text: 'Hel' },
    })
    const second = agentMessageOf({
      type: 'item.completed',
      item: { id: 'm1', status: 'completed', type: 'agent_message', text: 'Hello' },
    })

    expect(first).toEqual({ id: 'm1', text: 'Hel' })
    expect(second).toEqual({ id: 'm1', text: 'Hello' })
  })

  it('ignores items that are not the agent speaking', () => {
    expect(
      agentMessageOf({
        type: 'item.completed',
        item: { id: 't1', status: 'completed', type: 'tool_call', name: 'read', input: {} },
      }),
    ).toBeNull()
  })
})
