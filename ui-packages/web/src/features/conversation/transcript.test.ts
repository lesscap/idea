import type { WireEvent } from '@idea/shared'
import { describe, expect, it } from 'vitest'
import { isWorking, phaseOf, toBubbles, type WireStored } from './transcript'
import { mergeEvents } from './use-conversation'

// The two rules here are the ones that go wrong quietly: an answer rendered
// twice, and a reconnect that loses or duplicates part of the conversation.
// Both are pure, so both are cheap to pin down.

let nextId = 0
const stored = (sequence: number, event: WireEvent): WireStored => ({
  id: ++nextId,
  sequence,
  createdAt: '',
  event,
})

const said = (sequence: number, text: string) => stored(sequence, { type: 'user_message', text })

const answered = (sequence: number, id: string, text: string) =>
  stored(sequence, {
    type: 'item.completed',
    item: { id, status: 'completed', type: 'agent_message', text },
  })

describe('folding a transcript into what is drawn', () => {
  // The rule the adapter synthesises item ids for. A streaming answer arrives as
  // repeated frames carrying the whole text so far, so appending shows the reply
  // two or three times over.
  it('replaces an item in place rather than adding another', () => {
    const bubbles = toBubbles([
      stored(0, {
        type: 'item.started',
        item: { id: 'm1', status: 'in_progress', type: 'agent_message', text: 'Hel' },
      }),
      stored(1, {
        type: 'item.updated',
        item: { id: 'm1', status: 'in_progress', type: 'agent_message', text: 'Hello th' },
      }),
      stored(2, {
        type: 'item.completed',
        item: { id: 'm1', status: 'completed', type: 'agent_message', text: 'Hello there' },
      }),
    ])

    expect(bubbles).toHaveLength(1)
    expect(bubbles[0]).toMatchObject({ kind: 'agent', text: 'Hello there' })
  })

  // Replacement must not reorder. An answer that jumped below a later message
  // every time it grew would be unreadable.
  it('keeps a replaced item where it first appeared', () => {
    const bubbles = toBubbles([
      answered(0, 'm1', 'first'),
      said(1, 'a question'),
      answered(2, 'm1', 'first, revised'),
    ])

    expect(bubbles.map(b => b.kind)).toEqual(['agent', 'them'])
  })

  // Turn boundaries, heartbeats and provider notices are bookkeeping. Drawing
  // them would fill the panel with machinery nobody asked about.
  it('draws nothing for events that are not conversation', () => {
    const bubbles = toBubbles([
      stored(0, { type: 'turn.started' }),
      stored(1, { type: 'turn.heartbeat' }),
      stored(2, { type: 'thread.started', providerSessionId: 'x' }),
      stored(3, { type: 'turn.completed' }),
    ])

    expect(bubbles).toEqual([])
  })

  // Stopping something yourself is not a failure, and drawing it in red would
  // tell the person something went wrong when they are the one who stopped it.
  it('separates being stopped from having failed', () => {
    const [aborted] = toBubbles([stored(0, { type: 'turn.aborted', reason: 'interrupted' })])
    const [failed] = toBubbles([stored(1, { type: 'turn.failed', error: { message: 'boom' } })])

    expect(aborted?.kind).toBe('note')
    expect(failed?.kind).toBe('error')
  })

  it('keeps attachments on the user message that carried them', () => {
    const attachment = {
      fid: 'file123',
      filename: 'brief.pdf',
      contentType: 'application/pdf',
      size: 16,
    }
    const [bubble] = toBubbles([
      stored(0, { type: 'user_message', text: '', attachments: [attachment] }),
    ])

    expect(bubble).toEqual({ kind: 'them', key: 'seq:0', text: '', attachments: [attachment] })
  })
})

describe('is the agent working', () => {
  // The trap: a finished conversation is full of turn.started, so asking whether
  // any exists leaves the spinner on forever.
  it('is false once the last turn has closed', () => {
    expect(
      isWorking([
        said(0, 'one'),
        stored(1, { type: 'turn.started' }),
        stored(2, { type: 'turn.completed' }),
      ]),
    ).toBe(false)
  })

  // A message nobody has picked up yet is still work outstanding — the queue is
  // not empty just because no worker has claimed it.
  it('is true for a message with no turn yet', () => {
    expect(isWorking([said(0, 'hello')])).toBe(true)
  })

  // Opening a long conversation reads a WINDOW, and a tool-heavy turn is a long
  // run of item events between two distant boundaries — so the window can land
  // entirely inside one. The server widens it back to the boundary rather than
  // letting that happen, and this is what depends on it: given only the run,
  // there is nothing to decide from and a busy conversation reads as idle.
  it('needs a boundary in the window, and answers from it once there is one', () => {
    const midTurn = [answered(41, 'a', 'partway'), answered(42, 'b', 'still going')]

    expect(isWorking(midTurn)).toBe(false)
    expect(isWorking([stored(40, { type: 'turn.started' }), ...midTurn])).toBe(true)
  })
})

describe('conversation phase', () => {
  it('reports queued work independently of worker liveness', () => {
    expect(phaseOf([], { state: 'queued' })).toBe('queued')
  })

  it('describes progress inside a running turn', () => {
    const started = stored(0, { type: 'turn.started' })
    const tool = stored(1, {
      type: 'item.started',
      item: {
        id: 'tool-1',
        status: 'in_progress',
        type: 'command_execution',
        command: 'pwd',
        output: '',
      },
    })
    const answer = stored(2, {
      type: 'item.updated',
      item: { id: 'answer-1', status: 'in_progress', type: 'agent_message', text: 'Hello' },
    })

    expect(phaseOf([started], { state: 'running' })).toBe('thinking')
    expect(phaseOf([started, tool], { state: 'running' })).toBe('working')
    expect(phaseOf([started, tool, answer], { state: 'running' })).toBe('streaming')
    expect(phaseOf([started, answer], { state: 'idle' })).toBe('idle')
  })
})

describe('merging what arrived twice', () => {
  // Reconnecting deliberately overlaps: the tail opens first and the gap is read
  // second, so the same event can come down both paths.
  it('keeps one copy of an event delivered twice', () => {
    const event = answered(3, 'm1', 'hello')

    expect(mergeEvents([event], [event])).toHaveLength(1)
  })

  // The tail and the backfill do not arrive in order relative to each other.
  it('orders by sequence however the pieces arrived', () => {
    const merged = mergeEvents([said(5, 'later')], [said(1, 'earlier'), said(3, 'middle')])

    expect(merged.map(e => e.sequence)).toEqual([1, 3, 5])
  })

  it('leaves the list alone when there is nothing new', () => {
    const existing = [said(0, 'x')]

    expect(mergeEvents(existing, [])).toBe(existing)
  })
})
