import type { Prisma } from '@idea/core'
import type { ConversationEvent, ConversationEventType, Id, StoredEvent } from '@idea/shared'
import type { Service, ServiceApplication } from '../../types.ts'
import type { AppendHook, ConversationService } from './types.ts'

// The transcript, and the only account of what happened. Appends lock the
// conversation row before assigning max(sequence)+1, serialising one transcript
// without blocking conversations that are unrelated to it.

const MAX_SEQUENCE_RETRIES = 5

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

// One transcript row, and the StoredEvent describing it. The only place that
// knows how an event becomes a row and how a row becomes the wire shape.
//
// Sequence is a parameter rather than something this derives, because the two
// callers know it differently: an ordinary append has to read the tail under a
// row lock, while the first event of a brand-new conversation is zero by
// construction — nobody can be appending to an id that has not been returned yet.
export const writeEvent = async (
  tx: Prisma.TransactionClient,
  conversationId: Id,
  sequence: number,
  event: ConversationEvent,
): Promise<StoredEvent> => {
  const row = await tx.conversationEvent.create({
    data: {
      conversationId,
      sequence,
      type: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, createdAt: true },
  })
  return { id: row.id, sequence, event, createdAt: row.createdAt.toISOString() }
}

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
  const stored = await writeEvent(tx, conversationId, sequence, event)
  await after?.(tx, sequence)
  return stored
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

const ROW = { id: true, sequence: true, type: true, payload: true, createdAt: true } as const

type EventRow = { id: number; sequence: number; type: string; payload: unknown; createdAt: Date }

const toStored = (row: EventRow): StoredEvent => ({
  id: row.id,
  sequence: row.sequence,
  event: row.payload as ConversationEvent,
  createdAt: row.createdAt.toISOString(),
})

// Which events open or close a turn, as a QUERY rather than a test on events
// already in hand. isAgentWorking in @idea/shared answers the latter and is the
// authority on the classification; this asks the database the same question, so
// the names live here too. Typed, so a string that is not an event type fails to
// compile — but a newly added turn-closing event has to be listed in both.
const TURN_BOUNDARIES: readonly ConversationEventType[] = [
  'user_message',
  'turn.queued',
  'turn.started',
  'turn.completed',
  'turn.failed',
  'turn.aborted',
]

const BOUNDARY = new Set<string>(TURN_BOUNDARIES)

// Extends a window backwards until it holds a turn boundary.
//
// isAgentWorking decides from the LAST boundary in what it is given, so a window
// with none of them reports a busy conversation as idle. A window can genuinely
// miss them all: a tool-heavy turn is a long run of item events between two
// distant boundaries, and the window is sized in events.
//
// It reaches back to the boundary and takes everything in between, rather than
// splicing that one row in front. A window with a hole in it would leave the
// browser's "load earlier" cursor pointing past events nobody ever read, and
// they would never be asked for again.
//
// Costs two queries, and only when the window missed — which needs a single turn
// longer than the whole window.
const reachBackToBoundary = async (
  app: ServiceApplication,
  conversationId: Id,
  rows: EventRow[],
): Promise<EventRow[]> => {
  const oldest = rows[0]
  if (oldest === undefined || rows.some(row => BOUNDARY.has(row.type))) return rows

  const boundary = await app.$prisma.conversationEvent.findFirst({
    where: {
      conversationId,
      sequence: { lt: oldest.sequence },
      type: { in: [...TURN_BOUNDARIES] },
    },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  })
  if (!boundary) return rows

  const earlier = await app.$prisma.conversationEvent.findMany({
    where: { conversationId, sequence: { gte: boundary.sequence, lt: oldest.sequence } },
    orderBy: { sequence: 'asc' },
    select: ROW,
  })
  return [...earlier, ...rows]
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

  events: async (conversationId, { after, before, limit } = {}) => {
    // `after` is exclusive, so a reconnecting client passes the last sequence it
    // holds and receives only what it missed. No ceiling: a gap has to close.
    if (after !== undefined)
      return (
        await app.$prisma.conversationEvent.findMany({
          where: { conversationId, sequence: { gt: after } },
          orderBy: { sequence: 'asc' },
          select: ROW,
        })
      ).map(toStored)

    // Descending then reversed, so `take` cuts the OLD end of the range rather
    // than the recent one — the window has to sit at whichever end the reader is
    // looking at, which for an opening read is the bottom.
    const rows = (
      await app.$prisma.conversationEvent.findMany({
        where: { conversationId, ...(before === undefined ? {} : { sequence: { lt: before } }) },
        orderBy: { sequence: 'desc' },
        ...(limit === undefined ? {} : { take: limit }),
        select: ROW,
      })
    ).reverse()

    // Only an opening read needs the guarantee below. Paging backwards already
    // has the bottom of the transcript in hand, boundary included.
    return (before === undefined ? await reachBackToBoundary(app, conversationId, rows) : rows).map(
      toStored,
    )
  },
})
