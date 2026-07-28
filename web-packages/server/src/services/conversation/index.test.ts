import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEventBus } from '../../event-bus.ts'
import { databaseUrl, setupTestDb, type TestDb } from '../test-support.ts'
import { createConversationService } from './index.ts'

describe.skipIf(!databaseUrl)('conversation persistence', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      $events: createEventBus(),
      $conversation: createConversationService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  const start = (text: string) =>
    db.app.$conversation.start({
      workspaceId: db.workspaceId,
      createdById: db.userId,
      text,
    })

  it('starts with the first message and queued turn in one operation', async () => {
    const conversation = await start('第一条消息')

    const [events, turns] = await Promise.all([
      db.app.$conversation.events(conversation.id),
      db.prisma.turn.findMany({ where: { conversationId: conversation.id } }),
    ])

    expect(events).toMatchObject([
      { sequence: 0, event: { type: 'user_message', text: '第一条消息' } },
    ])
    expect(turns).toMatchObject([{ userEventSequence: 0, status: 'queued' }])
  })

  // Opening reads a window of the most recent events, and "load earlier" walks
  // back from the oldest one held. The two have to meet exactly: an overlap is
  // deduplicated by id in the browser, but a gap is events nobody asks for again.
  it('opens at the end and pages back to meet it', async () => {
    const conversation = await start('开始')
    for (const text of ['二', '三', '四', '五'])
      await db.app.$conversation.appendEvent(conversation.id, { type: 'user_message', text })

    const opened = await db.app.$conversation.events(conversation.id, { limit: 2 })
    const earlier = await db.app.$conversation.events(conversation.id, {
      before: opened[0]?.sequence,
      limit: 2,
    })

    expect(opened.map(e => e.sequence)).toEqual([3, 4])
    expect(earlier.map(e => e.sequence)).toEqual([1, 2])
  })

  // A window is sized in events, and a tool-heavy turn is a long run of them
  // between two distant boundaries — so a window can land wholly inside one.
  // The browser decides "is it working" from the last boundary in what it holds
  // (see isWorking in the web package), so a window carrying none of them
  // reports a busy conversation as idle.
  it('widens an opening window until it holds a turn boundary', async () => {
    const conversation = await start('开始')
    await db.app.$conversation.appendEvent(conversation.id, { type: 'turn.started' })
    for (const _ of [1, 2, 3, 4])
      await db.app.$conversation.appendEvent(conversation.id, { type: 'raw', raw: {} })

    // Both of the last two events are mid-turn noise: asked for literally, this
    // window would carry no boundary at all.
    const opened = await db.app.$conversation.events(conversation.id, { limit: 2 })

    expect(opened[0]?.event.type).toBe('turn.started')
  })
})
