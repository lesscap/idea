import type { Prisma } from '@idea/core'
import type { ConversationEvent, Id, StoredEvent } from '@idea/shared'
import type { Service, ServiceApplication } from '../../types.ts'
import type { AppendHook, ConversationService } from './types.ts'

// The transcript, and the only account of what happened. Appends lock the
// conversation row before assigning max(sequence)+1, serialising one transcript
// without blocking conversations that are unrelated to it.

const MAX_SEQUENCE_RETRIES = 5

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

const storeNextEvent = async (
  tx: Prisma.TransactionClient,
  conversationId: Id,
  event: ConversationEvent,
  after?: AppendHook,
): Promise<StoredEvent> => {
  // UPDATE takes the row lock through Prisma's schema-aware query and also
  // records honest activity; a rename must not be the last-active timestamp.
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
  return { id: row.id, sequence, event, createdAt: row.createdAt.toISOString() }
}

const appendOnce = async (
  app: ServiceApplication,
  conversationId: Id,
  event: ConversationEvent,
  after?: AppendHook,
): Promise<StoredEvent> => {
  const stored = await app.$prisma.$transaction(tx =>
    storeNextEvent(tx, conversationId, event, after),
  )
  // Publish only after commit: subscribers must never observe a rolled-back row.
  app.$events.publish(conversationId, stored)
  return stored
}

type ConversationEventLog = Pick<ConversationService, 'appendEvent' | 'events'>

export const createConversationEventLog: Service<ConversationEventLog> = app => ({
  appendEvent: async (conversationId, event, after) => {
    for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
      try {
        return await appendOnce(app, conversationId, event, after)
      } catch (error) {
        // The row lock is the mechanism. This retry is only a backstop for the
        // missing/deleted-row case where there is no row to lock.
        if (isUniqueViolation(error) && attempt < MAX_SEQUENCE_RETRIES - 1) continue
        throw error
      }
    }
    throw new Error(`could not assign a sequence for conversation ${conversationId}`)
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
})
