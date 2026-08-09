import 'dotenv/config'
import type { ConversationEvent } from '@idea/shared'
import type { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
import { createPrisma } from '../../db.ts'
import { ensureDemoContext } from './context.ts'
import { requireDemoDatabaseUrl } from './guard.ts'

// Development-only demonstration workspace, member, app and conversations.
// Requirement fixtures are deliberately separate: seed:demo:requirements.
//
//   pnpm --filter @idea/core seed:demo

const DEMO_CONVERSATION_COUNT = 24
const SIX_HOURS = 6 * 60 * 60 * 1000

const demoConversations = Array.from({ length: DEMO_CONVERSATION_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    index,
    title: `分页演示会话 ${number}`,
    userText: `这是第 ${number} 条分页演示会话。`,
    agentText: `已记录第 ${number} 条演示内容。`,
  }
})

const eventRows = (number: number, userText: string, agentText: string, createdAt: Date) => {
  const events = [
    { type: 'user_message', text: userText },
    {
      type: 'item.completed',
      item: {
        id: `demo-answer-${number}`,
        type: 'agent_message',
        status: 'completed',
        text: agentText,
      },
    },
    { type: 'turn.completed' },
  ] satisfies ConversationEvent[]

  return events.map((event, sequence) => ({
    sequence,
    type: event.type,
    payload: event as unknown as Prisma.InputJsonValue,
    createdAt,
  }))
}

const [prisma, disconnect] = createPrisma(requireDemoDatabaseUrl())
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    const provider = await tx.provider.findUnique({ where: { name: 'glm' }, select: { id: true } })
    if (!provider) throw new Error('seed:system must run before seed:demo')

    const context = await ensureDemoContext(tx, done)
    const existingTitles = new Set(
      (
        await tx.conversation.findMany({
          where: {
            appId: context.appId,
            titleLocked: true,
            title: { in: demoConversations.map(item => item.title) },
          },
          select: { title: true },
        })
      ).flatMap(row => (row.title ? [row.title] : [])),
    )
    const missing = demoConversations.filter(item => !existingTitles.has(item.title))
    const now = Date.now()

    await Promise.all(
      missing.map(item => {
        const lastActiveAt = new Date(now - item.index * SIX_HOURS)
        return tx.conversation.create({
          data: {
            cid: nanoid(12),
            appId: context.appId,
            createdById: context.userId,
            providerId: provider.id,
            title: item.title,
            titleLocked: true,
            createdAt: lastActiveAt,
            lastActiveAt,
            events: {
              create: eventRows(item.index + 1, item.userText, item.agentText, lastActiveAt),
            },
          },
        })
      }),
    )
    done.push(
      missing.length > 0
        ? `created ${missing.length} demo conversations`
        : 'demo conversations already exist',
    )
  })

  done.forEach(line => {
    console.log(`  ${line}`)
  })
} finally {
  await disconnect()
}
