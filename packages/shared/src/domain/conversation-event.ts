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

// Everything except `raw` — what the browser is allowed to see, and therefore
// what it compiles against.
//
// The projection that produces one belongs to the server (apps/web/wire.ts) and
// builds it by naming fields rather than by deleting one, so a variant added
// with a secret in it fails to compile there instead of leaking at runtime.
export type WireEvent =
  Exclude<ConversationEvent, { type: 'raw' }> extends infer E
    ? E extends unknown
      ? Omit<E, 'raw'>
      : never
    : never
