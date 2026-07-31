import type { Attachment, StoredEvent, WireEvent } from '@idea/shared'

// The transcript, folded into what is actually drawn.
//
// The rule that matters: items are keyed by their own id and REPLACED, never
// appended to. A streaming answer arrives as repeated frames carrying the whole
// text so far, so appending shows the reply two or three times over — which is
// why the adapter synthesises an id for blocks the provider does not identify.
//
// Which puts a requirement on the other side: those ids must be unique across
// the whole conversation, not just within one turn's stream. A per-turn counter
// made turn two's answer replace turn one's, and nothing here can tell the
// difference — an id is all this has to go on.

export type Bubble =
  | { kind: 'them'; key: string; text: string; attachments?: readonly Attachment[] }
  | { kind: 'agent'; key: string; text: string }
  | { kind: 'thinking'; key: string; text: string }
  | {
      kind: 'tool'
      key: string
      name: string
      // Kept so the collapsed row can say what the call was about rather than
      // only naming the tool, and so opening it shows the whole thing.
      input: unknown
      output?: string
      running: boolean
      failed: boolean
    }
  | { kind: 'error'; key: string; text: string }
  | { kind: 'note'; key: string; text: string }

const bubbleOf = (event: WireEvent, key: string): Bubble | null => {
  if (event.type === 'user_message')
    return {
      kind: 'them',
      key,
      text: event.text,
      ...(event.attachments?.length ? { attachments: event.attachments } : {}),
    }

  if (
    event.type === 'item.started' ||
    event.type === 'item.updated' ||
    event.type === 'item.completed'
  ) {
    const item = event.item
    // Keyed by the item, not by where it appeared: that is what makes a later
    // frame replace an earlier one instead of piling up beside it.
    const itemKey = `item:${item.id}`
    if (item.type === 'agent_message') return { kind: 'agent', key: itemKey, text: item.text }
    if (item.type === 'reasoning') return { kind: 'thinking', key: itemKey, text: item.text }
    if (item.type === 'error') return { kind: 'error', key: itemKey, text: item.message }
    return {
      kind: 'tool',
      key: itemKey,
      name: 'name' in item ? item.name : item.type,
      input: 'input' in item ? item.input : undefined,
      ...('output' in item && typeof item.output === 'string' ? { output: item.output } : {}),
      running: item.status === 'in_progress',
      failed: item.status === 'failed',
    }
  }

  if (event.type === 'turn.failed') return { kind: 'error', key, text: event.error.message }
  // Stopping on purpose is not a failure and must not be drawn as one.
  if (event.type === 'turn.aborted') return { kind: 'note', key, text: 'stopped' }
  // Everything else — turn boundaries, heartbeats, provider notices — is
  // bookkeeping rather than conversation.
  return null
}

export type WireStored = Omit<StoredEvent, 'event'> & { event: WireEvent }

export const toBubbles = (events: readonly WireStored[]): Bubble[] => {
  const byKey = new Map<string, Bubble>()

  for (const stored of events) {
    const bubble = bubbleOf(stored.event, `seq:${stored.sequence}`)
    // Setting an existing key replaces in place; Map preserves the insertion
    // order of the first write, so a growing answer stays where it started
    // rather than jumping to the end each time it grows.
    if (bubble) byKey.set(bubble.key, bubble)
  }

  return [...byKey.values()]
}

// Which events open and close a turn, mirroring isAgentWorking in @idea/shared —
// but over the wire projection, which is all the browser has. Deliberately not
// read off a status column: the transcript already says, and a second source
// would be a second thing to keep in step.
//
// Safe to answer from a WINDOW of the transcript rather than all of it: the
// server widens an opening read until it holds a boundary, so there is always
// one here to decide from. See the windowed events() read.
export const isWorking = (events: readonly WireStored[]): boolean => {
  const last = events.findLast(
    ({ event }) =>
      event.type === 'user_message' ||
      event.type === 'turn.started' ||
      event.type === 'turn.completed' ||
      event.type === 'turn.failed' ||
      event.type === 'turn.aborted',
  )
  if (!last) return false
  return last.event.type === 'user_message' || last.event.type === 'turn.started'
}
