import type { Attachment, ConversationEvent, Id, StoredEvent } from '@idea/shared'
import type { Service } from '../types.ts'

// What has been typed but not yet handed to the agent.
//
// Deliberately not an event: the transcript records what happened, and this has
// not happened yet. Keeping it apart buys two things a transcript-only design
// cannot have.
//
// MERGING. Someone describing a requirement thinks out loud — "I need expense
// approval", then "oh, and receipts", then "over 5000 needs a director". Those
// arrive as three inputs while a turn is running, and become ONE message. The
// agent answers the whole thought once instead of answering the first third of
// it three times.
//
// WITHDRAWAL. An unsent line can be taken back. Once it is in the transcript it
// is history, and history should not be edited.

export type PendingInput = {
  readonly id: Id
  readonly text: string
  readonly attachments: readonly Attachment[]
  readonly createdAt: string
}

export type PendingInputService = {
  list: (conversationId: Id) => Promise<PendingInput[]>
  enqueue: (
    conversationId: Id,
    input: { text: string; attachments?: readonly Attachment[] },
  ) => Promise<PendingInput>
  cancel: (conversationId: Id, inputId: Id) => Promise<boolean>
  // Turns everything pending into one message plus the turn that will answer it.
  // Null when there was nothing to send, or when the attempt lost a race and the
  // caller should look again.
  materialize: (conversationId: Id) => Promise<StoredEvent | null>
}

// Blank lines between them: the agent reads three bursts as three points, which
// is what they were, rather than as one run-on sentence.
export const mergePending = (
  items: readonly PendingInput[],
): Extract<ConversationEvent, { type: 'user_message' }> => {
  const text = items
    .map(item => item.text.trim())
    .filter(part => part !== '')
    .join('\n\n')
  const attachments = items.flatMap(item => [...item.attachments])
  return { type: 'user_message', text, ...(attachments.length > 0 ? { attachments } : {}) }
}

// Same rows, same order. Compared by id rather than by count because an input
// withdrawn and another added between the read and the commit leaves the count
// unchanged while the content is different.
export const sameBatch = (expected: readonly PendingInput[], actual: readonly PendingInput[]) =>
  expected.length === actual.length && expected.every((item, i) => item.id === actual[i]?.id)

const RACE = 'PENDING_INPUT_RACE'

const view = (row: {
  id: number
  text: string
  attachments: unknown
  createdAt: Date
}): PendingInput => ({
  id: row.id,
  text: row.text,
  attachments: Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [],
  createdAt: row.createdAt.toISOString(),
})

const SELECT = { id: true, text: true, attachments: true, createdAt: true } as const

export const createPendingInputService: Service<PendingInputService> = app => {
  const rowsFor = async (conversationId: Id): Promise<PendingInput[]> =>
    (
      await app.$prisma.pendingInput.findMany({
        where: { conversationId },
        orderBy: { id: 'asc' },
        select: SELECT,
      })
    ).map(view)

  return {
    list: rowsFor,

    enqueue: async (conversationId, input) =>
      view(
        await app.$prisma.pendingInput.create({
          data: {
            conversationId,
            text: input.text,
            ...(input.attachments?.length ? { attachments: [...input.attachments] } : {}),
          },
          select: SELECT,
        }),
      ),

    cancel: async (conversationId, inputId) => {
      const deleted = await app.$prisma.pendingInput.deleteMany({
        where: { id: inputId, conversationId },
      })
      return deleted.count === 1
    },

    // Read, verify, commit. The verification is not ceremony: between reading
    // the batch and writing the event, another request can add an input or a
    // sibling can start a turn. Committing regardless would either swallow the
    // new input — it would be deleted along with the batch it was never part of
    // — or run two turns at once.
    materialize: async conversationId => {
      const expected = await rowsFor(conversationId)
      if (expected.length === 0) return null
      try {
        return await app.$conversation.appendEvent(
          conversationId,
          async tx => {
            const configuration = await tx.conversation.findUniqueOrThrow({
              where: { id: conversationId },
              select: { model: true, effort: true, provider: { select: { config: true } } },
            })
            const provider = configuration.provider.config as { model: string }
            return {
              ...mergePending(expected),
              model: configuration.model ?? provider.model,
              ...(configuration.effort
                ? {
                    effort: configuration.effort as Extract<
                      ConversationEvent,
                      { type: 'user_message' }
                    >['effort'],
                  }
                : {}),
            }
          },
          // Runs inside appendEvent's transaction, which already holds this
          // conversation's row lock — so concurrent materialize calls arrive
          // here one at a time. The checks below still matter: the lock orders
          // them, it does not tell the second one that the first already
          // consumed the batch it read before it started waiting.
          async (tx, sequence) => {
            const [openTurns, actual] = await Promise.all([
              tx.turn.count({
                where: { conversationId, status: { in: ['queued', 'running'] } },
              }),
              tx.pendingInput.findMany({
                where: { conversationId },
                orderBy: { id: 'asc' },
                select: SELECT,
              }),
            ])
            if (openTurns !== 0) throw new Error(RACE)
            if (!sameBatch(expected, actual.map(view))) throw new Error(RACE)

            await tx.turn.create({ data: { conversationId, userEventSequence: sequence } })

            const deleted = await tx.pendingInput.deleteMany({
              where: { conversationId, id: { in: expected.map(item => item.id) } },
            })
            // Fewer rows than expected means someone withdrew one after the
            // comparison above — the message being written no longer matches
            // what is being consumed, so none of it stands.
            if (deleted.count !== expected.length) throw new Error(RACE)
          },
        )
      } catch (error) {
        if (error instanceof Error && error.message === RACE) return null
        throw error
      }
    },
  }
}
