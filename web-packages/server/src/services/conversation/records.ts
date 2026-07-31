import type { ConversationEvent } from '@idea/shared'
import { nanoid } from 'nanoid'
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
  cid: string
  appId: number
  agentKind: string | null
  providerSessionId: string | null
  title: string | null
  lastActiveAt: Date
}): Conversation => ({
  id: row.id,
  cid: row.cid,
  appId: row.appId,
  agentKind: row.agentKind,
  providerSessionId: row.providerSessionId,
  title: row.title,
  lastActiveAt: row.lastActiveAt.toISOString(),
})

const SELECT = {
  id: true,
  cid: true,
  appId: true,
  agentKind: true,
  providerSessionId: true,
  title: true,
  lastActiveAt: true,
} as const

type ConversationRecords = Pick<
  ConversationService,
  'start' | 'rememberSession' | 'nameIfUnnamed' | 'listForApp' | 'getByCid' | 'get'
>

export const createConversationRecords: Service<ConversationRecords> = app => ({
  // The conversation, its first message and the turn that will answer it, in one
  // transaction. Any two of the three without the third is a row the list cannot
  // show or a message nobody will pick up — which is what separate create and
  // send requests leave behind whenever only the second one fails.
  //
  // Nothing is published: the id has not left this function yet, so there is no
  // subscriber to tell.
  start: async ({ appId, createdById, text, attachments }) => {
    const event: ConversationEvent = {
      type: 'user_message',
      text,
      ...(attachments?.length ? { attachments } : {}),
    }
    return app.$prisma.$transaction(async tx => {
      const conversation = view(
        await tx.conversation.create({
          data: { cid: nanoid(12), appId, createdById },
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

  // Conditional rather than a plain update, because the name arrives from a
  // worker some seconds after the exchange it describes. In that gap the person
  // may have named the conversation themselves, and a summary does not get to
  // overwrite a deliberate choice — which is the whole job of `titleLocked`.
  nameIfUnnamed: async (conversationId, title) => {
    const named = await app.$prisma.conversation.updateMany({
      where: {
        id: conversationId,
        titleLocked: false,
        OR: [{ title: null }, { title: '' }],
      },
      data: { title },
    })
    return named.count === 1
  },

  // Most recently active first, which is also the order the sidebar wants. That
  // makes the sort key one that MOVES: saying anything reorders the list under a
  // reader who is paging through it, so the browser deduplicates by id when it
  // appends — see mergeConversations.
  listForApp: async (appId, query) => {
    const { offset, limit } = toOffset(query)
    const [rows, total] = await Promise.all([
      app.$prisma.conversation.findMany({
        where: { appId },
        orderBy: { lastActiveAt: 'desc' },
        skip: offset,
        take: limit,
        select: SELECT,
      }),
      app.$prisma.conversation.count({ where: { appId } }),
    ])
    return paged(rows.map(view), total, query)
  },

  getByCid: async (appId, cid) => {
    const row = await app.$prisma.conversation.findFirst({ where: { appId, cid }, select: SELECT })
    return row ? view(row) : null
  },

  get: async id => {
    const row = await app.$prisma.conversation.findUnique({ where: { id }, select: SELECT })
    return row ? view(row) : null
  },
})
