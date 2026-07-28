import type { Prisma } from '@idea/core'
import type { ConversationEvent, Id, StoredEvent } from '@idea/shared'
import type { Service } from '../types.ts'

// The transcript, and the only account of what happened.
//
// `sequence` is assigned inside the append transaction as max+1, with the
// conversation row locked first. The lock is not decoration: read-max-then-write
// without it means N concurrent appends all read the same max, one wins and the
// rest retry — and the last one needs O(N) attempts, so any fixed retry budget
// is a concurrency ceiling rather than a safety net. A streaming turn emits
// item.updated frames faster than that.
//
// Locking per conversation costs nothing globally: appends to one conversation
// have to be serialised anyway to number them, and appends to different
// conversations never touch the same row.

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

const MAX_SEQUENCE_RETRIES = 5

// Prisma reports a unique-constraint violation as P2002. Here it means two
// appends picked the same sequence, which is expected under concurrency and
// recoverable by re-reading the tail.
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

const view = (row: {
  id: number
  workspaceId: number
  agentKind: string | null
  providerSessionId: string | null
  title: string | null
  lastActiveAt: Date
}): Conversation => ({
  id: row.id,
  workspaceId: row.workspaceId,
  agentKind: row.agentKind,
  providerSessionId: row.providerSessionId,
  title: row.title,
  lastActiveAt: row.lastActiveAt.toISOString(),
})

const SELECT = {
  id: true,
  workspaceId: true,
  agentKind: true,
  providerSessionId: true,
  title: true,
  lastActiveAt: true,
} as const

export const createConversationService: Service<ConversationService> = app => {
  const appendEvent: ConversationService['appendEvent'] = async (conversationId, event, after) => {
    for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
      try {
        return await app.$prisma
          .$transaction(async tx => {
            // Takes the conversation's row lock, held until this transaction
            // commits, which is what serialises appends to it. Anything else
            // reaching this line waits rather than racing for the same sequence.
            //
            // An UPDATE rather than `SELECT … FOR UPDATE` because raw SQL names
            // tables unqualified and resolves them through search_path, which the
            // driver adapter does not set — the lock would silently apply to a
            // different schema's table. A generated query is always aimed
            // correctly. The write is one this function owed anyway: `updatedAt`
            // would also move on a rename and report an untouched conversation as
            // active, so activity is stamped explicitly.
            await tx.conversation.update({
              where: { id: conversationId },
              data: { lastActiveAt: new Date() },
            })
            const last = await tx.conversationEvent.findFirst({
              where: { conversationId },
              orderBy: { sequence: 'desc' },
              select: { sequence: true },
            })
            const sequence = (last?.sequence ?? -1) + 1
            const row = await tx.conversationEvent.create({
              data: {
                conversationId,
                sequence,
                type: event.type,
                payload: event as unknown as Prisma.InputJsonValue,
              },
              select: { id: true, sequence: true, createdAt: true },
            })
            await after?.(tx, sequence)
            return {
              id: row.id,
              sequence: row.sequence,
              event,
              createdAt: row.createdAt.toISOString(),
            }
          })
          .then(stored => {
            // Published after the transaction commits, not inside it: a subscriber
            // told about an event that then rolled back would hold something the
            // transcript does not have.
            app.$events.publish(conversationId, stored)
            return stored
          })
      } catch (error) {
        // A backstop, not the mechanism — the lock above is. It still matters
        // for the one case the lock cannot cover: a conversation row that does
        // not exist locks nothing, so two appends to a deleted conversation
        // would race before the foreign key rejects them.
        //
        // A hook that rejected because it lost its own race is not retried: it
        // has already decided this append should not happen, and running it
        // again would fight whoever won.
        if (isUniqueViolation(error) && attempt < MAX_SEQUENCE_RETRIES - 1) continue
        throw error
      }
    }
    throw new Error(`could not assign a sequence for conversation ${conversationId}`)
  }

  return {
    appendEvent,

    start: async ({ workspaceId, createdById, text }) => {
      const event: ConversationEvent = { type: 'user_message', text }
      const { conversation, stored } = await app.$prisma.$transaction(async tx => {
        const conversation = view(
          await tx.conversation.create({
            data: { workspaceId, createdById },
            select: SELECT,
          }),
        )
        const row = await tx.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            sequence: 0,
            type: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
          },
          select: { id: true, sequence: true, createdAt: true },
        })
        await tx.turn.create({
          data: { conversationId: conversation.id, userEventSequence: row.sequence },
        })
        return {
          conversation,
          stored: {
            id: row.id,
            sequence: row.sequence,
            event,
            createdAt: row.createdAt.toISOString(),
          },
        }
      })
      app.$events.publish(conversation.id, stored)
      return conversation
    },

    rememberSession: async (conversationId, providerSessionId) => {
      await app.$prisma.conversation.update({
        where: { id: conversationId },
        data: { providerSessionId },
      })
    },

    listForWorkspace: async workspaceId =>
      (
        await app.$prisma.conversation.findMany({
          where: { workspaceId, events: { some: { type: 'user_message' } } },
          orderBy: { lastActiveAt: 'desc' },
          select: SELECT,
        })
      ).map(view),

    get: async id => {
      const row = await app.$prisma.conversation.findUnique({ where: { id }, select: SELECT })
      return row ? view(row) : null
    },

    // `after` is exclusive, so a reconnecting client passes the last sequence it
    // holds and receives only what it missed.
    events: async (conversationId, after) =>
      (
        await app.$prisma.conversationEvent.findMany({
          where: { conversationId, ...(after === undefined ? {} : { sequence: { gt: after } }) },
          orderBy: { sequence: 'asc' },
          select: { id: true, sequence: true, payload: true, createdAt: true },
        })
      ).map(row => ({
        id: row.id,
        sequence: row.sequence,
        event: row.payload as unknown as ConversationEvent,
        createdAt: row.createdAt.toISOString(),
      })),
  }
}
