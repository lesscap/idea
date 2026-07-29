import type { Prisma } from '@idea/core'
import type { ConversationEvent, Id, Paged, PageQuery, StoredEvent } from '@idea/shared'

export type Conversation = {
  readonly id: Id
  readonly workspaceId: Id
  // Null until a worker has claimed the first turn. Nobody chooses a backend in
  // advance — whichever worker reaches it decides, and it is fixed from then on.
  readonly agentKind: string | null
  readonly providerSessionId: string | null
  readonly title: string | null
  readonly lastActiveAt: string
}

// Runs inside the append transaction, once the sequence is known. Used by
// materialize to create the turn that points at the event it just wrote —
// event and turn have to land together or not at all.
export type AppendHook = (tx: Prisma.TransactionClient, sequence: number) => Promise<void>

// How much of a transcript to read.
//
// `after` is the reconnect path — everything past a sequence the caller already
// holds, with no ceiling, because whatever was missed has to arrive. The other
// two read history backwards: `limit` on its own opens at the most recent N,
// and `before` walks further back from there.
export type EventWindow = {
  readonly after?: number
  readonly before?: number
  readonly limit?: number
}

export type ConversationService = {
  start: (input: { workspaceId: Id; createdById: Id; text: string }) => Promise<Conversation>
  listForWorkspace: (workspaceId: Id, query: PageQuery) => Promise<Paged<Conversation>>
  get: (id: Id) => Promise<Conversation | null>
  events: (conversationId: Id, window?: EventWindow) => Promise<StoredEvent[]>
  appendEvent: (
    conversationId: Id,
    event: ConversationEvent,
    after?: AppendHook,
  ) => Promise<StoredEvent>
  // The provider's own handle for this conversation, so a later turn can resume
  // rather than start over.
  rememberSession: (conversationId: Id, providerSessionId: string) => Promise<void>
  // Names a conversation, but only while it has no name. False means someone got
  // there first — which the caller reports rather than retries.
  nameIfUnnamed: (conversationId: Id, title: string) => Promise<boolean>
}
