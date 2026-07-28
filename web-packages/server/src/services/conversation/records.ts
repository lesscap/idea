import type { Prisma } from '@idea/core'
import type { ConversationEvent } from '@idea/shared'
import type { Service } from '../../types.ts'
import type { Conversation, ConversationService } from './types.ts'

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
})
