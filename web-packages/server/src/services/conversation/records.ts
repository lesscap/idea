import type { ConversationEvent } from '@idea/shared'
import { paged, toOffset } from '../../paging.ts'
import type { Service } from '../../types.ts'
import { writeEvent } from './event-log.ts'
import type { Conversation, ConversationService } from './types.ts'

// Where a transcript starts. `start` writes it directly instead of asking for
// the next sequence — see writeEvent for why that is safe here and not in an
// ordinary append.
const FIRST_SEQUENCE = 0

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

type ConversationRecords = Pick<
  ConversationService,
  'start' | 'rememberSession' | 'listForWorkspace' | 'get'
>

export const createConversationRecords: Service<ConversationRecords> = app => ({
  // The conversation, its first message and the turn that will answer it, in one
  // transaction. Any two of the three without the third is a row the list cannot
  // show or a message nobody will pick up — which is what separate create and
  // send requests leave behind whenever only the second one fails.
  //
  // Nothing is published: the id has not left this function yet, so there is no
  // subscriber to tell.
  start: async ({ workspaceId, createdById, text }) => {
    const event: ConversationEvent = { type: 'user_message', text }
    return app.$prisma.$transaction(async tx => {
      const conversation = view(
        await tx.conversation.create({
          data: { workspaceId, createdById },
          select: SELECT,
        }),
      )
      await writeEvent(tx, conversation.id, FIRST_SEQUENCE, event)
      await tx.turn.create({
        data: { conversationId: conversation.id, userEventSequence: FIRST_SEQUENCE },
      })
      return conversation
    })
  },

  rememberSession: async (conversationId, providerSessionId) => {
    await app.$prisma.conversation.update({
      where: { id: conversationId },
      data: { providerSessionId },
    })
  },

  // Most recently active first, which is also the order the sidebar wants. That
  // makes the sort key one that MOVES: saying anything reorders the list under a
  // reader who is paging through it, so the browser deduplicates by id when it
  // appends — see mergeConversations.
  listForWorkspace: async (workspaceId, query) => {
    const { offset, limit } = toOffset(query)
    const [rows, total] = await Promise.all([
      app.$prisma.conversation.findMany({
        where: { workspaceId },
        orderBy: { lastActiveAt: 'desc' },
        skip: offset,
        take: limit,
        select: SELECT,
      }),
      app.$prisma.conversation.count({ where: { workspaceId } }),
    ])
    return paged(rows.map(view), total, query)
  },

  get: async id => {
    const row = await app.$prisma.conversation.findUnique({ where: { id }, select: SELECT })
    return row ? view(row) : null
  },
})
