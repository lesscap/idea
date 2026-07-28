import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEventBus } from '../event-bus.ts'
import { createConversationService } from './conversation.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'

describe.skipIf(!databaseUrl)('conversation persistence', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      $events: createEventBus(),
      $conversation: createConversationService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  it('starts with the first message and queued turn in one operation', async () => {
    const conversation = await db.app.$conversation.start({
      workspaceId: db.workspaceId,
      createdById: db.userId,
      text: '第一条消息',
    })

    const [events, turns] = await Promise.all([
      db.app.$conversation.events(conversation.id),
      db.prisma.turn.findMany({ where: { conversationId: conversation.id } }),
    ])

    expect(events).toMatchObject([
      { sequence: 0, event: { type: 'user_message', text: '第一条消息' } },
    ])
    expect(turns).toMatchObject([{ userEventSequence: 0, status: 'queued' }])
  })

  it('does not list legacy empty conversations', async () => {
    const empty = await db.prisma.conversation.create({
      data: { workspaceId: db.workspaceId, createdById: db.userId },
      select: { id: true },
    })

    const listed = await db.app.$conversation.listForWorkspace(db.workspaceId)

    expect(listed.map(conversation => conversation.id)).not.toContain(empty.id)
  })
})
