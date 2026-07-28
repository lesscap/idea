import type { Prisma } from '@idea/core'
import type { ConversationEvent, Id, StoredEvent } from '@idea/shared'

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

export type ConversationService = {
  start: (input: { workspaceId: Id; createdById: Id; text: string }) => Promise<Conversation>
  listForWorkspace: (workspaceId: Id) => Promise<Conversation[]>
  get: (id: Id) => Promise<Conversation | null>
  events: (conversationId: Id, after?: number) => Promise<StoredEvent[]>
  appendEvent: (
    conversationId: Id,
    event: ConversationEvent,
    after?: AppendHook,
  ) => Promise<StoredEvent>
  // The provider's own handle for this conversation, so a later turn can resume
  // rather than start over.
  rememberSession: (conversationId: Id, providerSessionId: string) => Promise<void>
}
