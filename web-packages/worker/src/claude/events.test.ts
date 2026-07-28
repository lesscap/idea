import type { ConversationEvent } from '@idea/shared'
import { describe, expect, it } from 'vitest'
import { claudeEvents } from './events.ts'
import type { SdkMessage } from './sdk-types.ts'

// Literal message sequences in, canonical events out. No network and no SDK:
// what is being checked is the translation, and feeding it fixed input is the
// only way to check the cases a live model rarely produces on demand.

const runIn = async (scope: string, ...messages: SdkMessage[]): Promise<ConversationEvent[]> => {
  const source = (async function* () {
    for (const message of messages) yield message
  })()
  const out: ConversationEvent[] = []
  for await (const event of claudeEvents(source, scope)) out.push(event)
  return out
}

const run = (...messages: SdkMessage[]) => runIn('t1', ...messages)

const idsOf = (events: ConversationEvent[]) =>
  events.flatMap(e => ('item' in e && e.item ? [e.item.id] : []))

const types = (events: ConversationEvent[]) => events.map(e => e.type)

const SYSTEM: SdkMessage = { type: 'system', session_id: 'sess-1' }
const DONE: SdkMessage = { type: 'result', subtype: 'success' }

const say = (text: string): SdkMessage => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
})

const think = (thinking: string): SdkMessage => ({
  type: 'assistant',
  message: { content: [{ type: 'thinking', thinking }] },
})

// The ids Claude does not supply have to be unique across the CONVERSATION, not
// just this stream — the browser replaces items by id, so a second turn reusing
// the first turn's ids overwrites its answer and the transcript loses a reply.
// A per-stream counter alone did exactly that, and it was invisible until two
// turns were run back to back.
describe('identity across turns', () => {
  it("does not reuse an earlier turn's ids for the same block sequence", async () => {
    const first = idsOf(await runIn('t1', SYSTEM, think('why'), say('because'), DONE))
    const second = idsOf(await runIn('t2', SYSTEM, think('why'), say('because'), DONE))

    expect(first).toHaveLength(2)
    expect(second).toHaveLength(2)
    expect(first.filter(id => second.includes(id))).toEqual([])
  })

  // Within one stream the opposite must hold: a block that grows across frames
  // has to keep its id, or a streaming answer is drawn once per frame.
  it('keeps one id per block within a turn', async () => {
    const ids = idsOf(await run(SYSTEM, say('partial'), say('partial and more'), DONE))

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('turn boundaries', () => {
  it('opens with the session handle the next turn resumes from', async () => {
    const events = await run(SYSTEM, say('hello'), DONE)

    expect(events[0]).toMatchObject({ type: 'thread.started', providerSessionId: 'sess-1' })
    // No turn.started here on purpose: the caller emits that, because only it
    // knows which message the turn is answering.
    expect(types(events)).toEqual(['thread.started', 'item.completed', 'turn.completed'])
  })

  // Later system messages are configuration notices. Announcing the thread again
  // would read as a second conversation starting inside this one.
  it('announces the thread once, however many system messages arrive', async () => {
    const events = await run(SYSTEM, { type: 'system', session_id: 'sess-1' }, say('hi'), DONE)

    expect(events.filter(e => e.type === 'thread.started')).toHaveLength(1)
  })

  // Without this the conversation has nothing to resume from, and every later
  // turn starts the agent over with no memory.
  it('still reports the session when there was no system message', async () => {
    const events = await run(say('hi'), { type: 'result', subtype: 'success', session_id: 'late' })

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'thread.started', providerSessionId: 'late' }),
    )
  })

  it('reports a failed result as a failure, with what the SDK said', async () => {
    const events = await run(SYSTEM, {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'context window exceeded',
    })

    expect(events.at(-1)).toMatchObject({
      type: 'turn.failed',
      error: { message: 'context window exceeded' },
    })
  })

  // `subtype` alone can carry the failure — an error is not always flagged.
  it('treats a non-success subtype as a failure even without the error flag', async () => {
    const events = await run(SYSTEM, { type: 'result', subtype: 'max_turns' })

    expect(events.at(-1)?.type).toBe('turn.failed')
  })
})

describe('items', () => {
  // Items are replaced by id, not appended to. Two messages in one turn sharing
  // an id would show the second in place of the first.
  it('gives each block its own id', async () => {
    const events = await run(SYSTEM, say('first'), say('second'), DONE)
    const ids = events.flatMap(e => ('item' in e ? [e.item.id] : []))

    expect(new Set(ids).size).toBe(2)
  })

  it('carries reasoning through as its own kind', async () => {
    const events = await run(
      SYSTEM,
      {
        type: 'assistant',
        message: { content: [{ type: 'thinking', thinking: 'weighing it up' }] },
      },
      DONE,
    )

    expect(events[1]).toMatchObject({
      type: 'item.completed',
      item: { type: 'reasoning', text: 'weighing it up' },
    })
  })
})

describe('tool calls, which arrive in two halves', () => {
  const CALL: SdkMessage = {
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'a.txt' } }],
    },
  }
  const RESULT: SdkMessage = {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'file contents' }],
    },
  }

  // The pairing this adapter exists to absorb: the call is in one message and
  // its result in a later one. Downstream should see one item that finished, not
  // two fragments to match up again.
  it('folds the result back into the call that started it', async () => {
    const events = await run(SYSTEM, CALL, RESULT, DONE)
    const started = events.find(e => e.type === 'item.started')
    const completed = events.find(e => e.type === 'item.completed')

    expect(started).toMatchObject({ item: { id: 'toolu_1', status: 'in_progress', name: 'Read' } })
    expect(completed).toMatchObject({
      item: { id: 'toolu_1', status: 'completed', output: 'file contents' },
    })
  })

  it('marks a failed call failed rather than merely finished', async () => {
    const events = await run(SYSTEM, CALL, {
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'no such file', is_error: true },
        ],
      },
    })

    expect(events.find(e => e.type === 'item.completed')).toMatchObject({
      item: { status: 'failed', isError: true },
    })
  })

  it('reads a result delivered as blocks rather than a string', async () => {
    const events = await run(SYSTEM, CALL, {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: [
              { type: 'text', text: 'line one' },
              { type: 'text', text: 'line two' },
            ],
          },
        ],
      },
    })

    expect(events.find(e => e.type === 'item.completed')).toMatchObject({
      item: { output: 'line one\nline two' },
    })
  })

  // A gap in the mapping should be visible in the transcript rather than
  // swallowed — and must not take the turn down with it.
  it('keeps a result with no matching call instead of dropping or throwing', async () => {
    const events = await run(SYSTEM, RESULT, DONE)

    expect(types(events)).toContain('raw')
    expect(types(events)).toContain('turn.completed')
  })
})

describe('what it does not recognise', () => {
  // A new provider, or a new SDK version, should be able to run before every one
  // of its messages has a mapping.
  it('passes an unknown message through without failing the turn', async () => {
    const events = await run(SYSTEM, { type: 'some_future_message' }, say('still here'), DONE)

    expect(types(events)).toContain('raw')
    expect(events.at(-1)?.type).toBe('turn.completed')
  })

  it('passes an unknown block through without failing the turn', async () => {
    const events = await run(
      SYSTEM,
      { type: 'assistant', message: { content: [{ type: 'server_tool_use' }] } },
      DONE,
    )

    expect(types(events)).toContain('raw')
    expect(events.at(-1)?.type).toBe('turn.completed')
  })
})

// The duplicate that a live run surfaced immediately: both this adapter and the
// turn runner were opening the turn.
describe('who opens the turn', () => {
  it('leaves turn.started to the caller', async () => {
    const events = await run(SYSTEM, say('hi'), DONE)

    expect(types(events)).not.toContain('turn.started')
  })
})
