import type { Id } from '../ids.ts'

// The canonical conversation protocol. Every agent provider is normalised into
// this at the source (in the worker), so nothing downstream — the web
// transcript, title generation, later requirement extraction — ever learns
// which agent produced an event.
//
// The shape is borrowed from two places, each for what it does better:
//
//   envelope    from the Codex SDK — items carry their own id and status and are
//               self-contained snapshots. Claude's raw stream instead emits a
//               tool_use in one message and its tool_result in a later one, so a
//               consumer has to pair them across messages. Normalising to the
//               item envelope pays that cost once, in the adapter.
//
//   tool call   from Claude — one generic `tool_call` wide enough to carry any
//               tool. The typed refinements below (command_execution,
//               file_change, …) are conveniences; anything that does not fit one
//               degrades to `tool_call` rather than growing this union.
//
// Both baton and term-web arrived at this same shape independently, which is the
// strongest argument available that it is the right one.

export type ItemStatus = 'in_progress' | 'completed' | 'failed'

type BaseItem = {
  // Stable across the item's lifetime — item.updated and item.completed REPLACE
  // an earlier frame with the same id rather than appending to it. Providers
  // that do not supply one (Claude gives no id to text or reasoning blocks) get
  // a synthesised id from the adapter; without it, streaming renders duplicates.
  id: string
  status: ItemStatus
}

export type AgentItem =
  | (BaseItem & { type: 'agent_message'; text: string })
  | (BaseItem & { type: 'reasoning'; text: string })
  | (BaseItem & {
      type: 'tool_call'
      name: string
      input: unknown
      output?: unknown
      isError?: boolean
    })
  | (BaseItem & { type: 'command_execution'; command: string; output: string; exitCode?: number })
  | (BaseItem & {
      type: 'file_change'
      changes: readonly { path: string; kind: 'add' | 'update' | 'delete' }[]
    })
  | (BaseItem & {
      type: 'mcp_tool_call'
      server: string
      tool: string
      input: unknown
      output?: unknown
    })
  | (BaseItem & { type: 'web_search'; query: string })
  | (BaseItem & { type: 'todo_list'; items: readonly { text: string; completed: boolean }[] })
  | (BaseItem & { type: 'error'; message: string })

export type AgentUsage = {
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
  totalCostUsd?: number
  durationMs?: number
}

export type Attachment = {
  id: Id
  name: string
  contentType: string
  size: number
}

// The provider's untouched payload. Kept server-side for replay and for working
// out what an adapter got wrong — and never sent anywhere, because it can carry
// an environment dump, a credential passed as a tool argument, or the full
// contents of a file. See toWireEvent.
type WithRaw = { raw?: unknown }

// Why the user's own turn boundaries are dotted like the borrowed ones but
// `user_message` is not: dotted names come from the Codex envelope, snake_case
// ones are this protocol's own additions. The log is a complete transcript only
// because the user's side is in it too.
export type ConversationEvent =
  | (WithRaw & {
      type: 'user_message'
      text: string
      attachments?: readonly Attachment[]
      // Stamped per turn rather than read from the conversation at replay time,
      // so replaying an old turn reproduces the choices in force when it ran.
      model?: string
      effort?: string
    })
  | (WithRaw & { type: 'thread.started'; providerSessionId: string; model?: string })
  | (WithRaw & { type: 'turn.started'; sourceSequence?: number })
  | (WithRaw & { type: 'item.started'; item: AgentItem })
  | (WithRaw & { type: 'item.updated'; item: AgentItem })
  | (WithRaw & { type: 'item.completed'; item: AgentItem })
  | (WithRaw & { type: 'turn.completed'; usage?: AgentUsage; sourceSequence?: number })
  | (WithRaw & { type: 'turn.failed'; error: { message: string }; sourceSequence?: number })
  // Distinct from turn.failed on purpose: stopping something yourself is not an
  // error and must not render as one.
  | (WithRaw & {
      type: 'turn.aborted'
      reason?: 'queued_cancelled' | 'interrupted'
      sourceSequence?: number
    })
  // Alive but with nothing to say — a single long tool call emits no other
  // event for minutes. Renews the turn's lease; renders as nothing.
  | (WithRaw & { type: 'turn.heartbeat' })
  // Provider noise that is not the user's problem: transport fallbacks,
  // reconnect notices. Deliberately not `error`.
  | (WithRaw & { type: 'system'; action: string; message?: string })
  | (WithRaw & { type: 'error'; message: string })
  // Nothing the adapter recognised. Lets a new provider run before every one of
  // its events has a mapping, instead of failing the turn.
  | { type: 'raw'; raw: unknown }

export type ConversationEventType = ConversationEvent['type']

// One row of the durable log.
export type StoredEvent = {
  readonly id: Id
  readonly sequence: number
  readonly event: ConversationEvent
  readonly createdAt: string
}

// --- the wire boundary -------------------------------------------------------

// Everything except `raw`. Built by naming fields rather than by deleting one,
// because a field that is never copied cannot be forgotten: adding a variant
// with a secret in it fails to compile here instead of leaking at runtime.
export type WireEvent =
  Exclude<ConversationEvent, { type: 'raw' }> extends infer E
    ? E extends unknown
      ? Omit<E, 'raw'>
      : never
    : never

// Strip the provider payload before an event leaves the server. `raw` exists to
// make an adapter debuggable, not to be rendered — the UI reads only the
// normalised shape, so sending it is both a leak and a waste.
//
// The 'raw' variant collapses to a `system` note: a client that cannot render an
// unmapped provider event should still see that something happened.
export const toWireEvent = (event: ConversationEvent): WireEvent => {
  switch (event.type) {
    case 'user_message':
      return {
        type: 'user_message',
        text: event.text,
        ...(event.attachments ? { attachments: event.attachments } : {}),
        ...(event.model ? { model: event.model } : {}),
        ...(event.effort ? { effort: event.effort } : {}),
      }
    case 'thread.started':
      return {
        type: 'thread.started',
        providerSessionId: event.providerSessionId,
        ...(event.model ? { model: event.model } : {}),
      }
    case 'turn.started':
      return { type: 'turn.started', ...seq(event.sourceSequence) }
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      return { type: event.type, item: event.item }
    case 'turn.completed':
      return {
        type: 'turn.completed',
        ...(event.usage ? { usage: event.usage } : {}),
        ...seq(event.sourceSequence),
      }
    case 'turn.failed':
      return {
        type: 'turn.failed',
        error: { message: event.error.message },
        ...seq(event.sourceSequence),
      }
    case 'turn.aborted':
      return {
        type: 'turn.aborted',
        ...(event.reason ? { reason: event.reason } : {}),
        ...seq(event.sourceSequence),
      }
    case 'turn.heartbeat':
      return { type: 'turn.heartbeat' }
    case 'system':
      return {
        type: 'system',
        action: event.action,
        ...(event.message ? { message: event.message } : {}),
      }
    case 'error':
      return { type: 'error', message: event.message }
    case 'raw':
      return { type: 'system', action: 'unmapped_provider_event' }
  }
}

const seq = (sourceSequence?: number) => (sourceSequence === undefined ? {} : { sourceSequence })

// --- derived state -----------------------------------------------------------

const OPENS = new Set<ConversationEventType>(['user_message', 'turn.started'])
const CLOSES = new Set<ConversationEventType>(['turn.completed', 'turn.failed', 'turn.aborted'])

// Is a turn open right now? Decided by the LAST boundary event, not by whether
// any exists — a finished conversation is full of turn.started, so `some` would
// answer yes forever.
//
// Derived rather than read off the Turn row so the web can answer it from the
// transcript it already holds, with no extra request.
export const isAgentWorking = (events: readonly StoredEvent[]): boolean => {
  const last = events.findLast(e => OPENS.has(e.event.type) || CLOSES.has(e.event.type))
  return last ? OPENS.has(last.event.type) : false
}

// The agent's prose, or null for anything else. item.updated / item.completed
// replace an earlier frame with the same id — keyed replacement, not
// concatenation — so a caller accumulating text must key by this id.
export const agentMessageOf = (event: ConversationEvent): { id: string; text: string } | null => {
  if (
    event.type !== 'item.started' &&
    event.type !== 'item.updated' &&
    event.type !== 'item.completed'
  )
    return null
  if (event.item.type !== 'agent_message') return null
  const text = event.item.text.trim()
  return text ? { id: event.item.id, text } : null
}
