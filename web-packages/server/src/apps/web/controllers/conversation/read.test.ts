import { describe, expect, it, vi } from 'vitest'
import type { CommandBus } from '../../../../command-bus.ts'
import type { Conversation, ConversationService } from '../../../../services/conversation/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { json, mountController } from '../../test-support.ts'
import { ConversationsController } from './index.ts'

// Only the calls these two routes make are stubbed. A cast is unavoidable —
// each service type is a whole interface — but going through Partial<T> keeps
// the parts that ARE written honest: a misspelled method or a wrong signature
// still fails to compile, where a bare `as never` would swallow both.
const stub = <T>(calls: Partial<T>): T => calls as T

const created: Conversation = {
  id: 42,
  workspaceId: 11,
  agentKind: null,
  providerSessionId: null,
  title: null,
  lastActiveAt: '2026-07-28T00:00:00.000Z',
}

const mount = (start: ConversationService['start']) => {
  const broadcast = vi.fn()
  return {
    app: mountController(
      ConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $conversation: stub<ConversationService>({ start }),
        $commands: stub<CommandBus>({ broadcast }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true },
    ),
    broadcast,
  }
}

describe('starting a conversation', () => {
  it('passes the first message into creation and announces the queued work', async () => {
    const start = vi.fn(async () => created)
    const { app, broadcast } = mount(start)

    const response = await app.request('/', json({ text: '  第一条消息  ' }))

    expect(response.status).toBe(200)
    expect(start).toHaveBeenCalledWith({
      workspaceId: 11,
      createdById: 7,
      text: '第一条消息',
    })
    expect(broadcast).toHaveBeenCalledWith({ type: 'work_available' })
  })

  it('rejects an empty first message before creating anything', async () => {
    const start = vi.fn()
    const { app, broadcast } = mount(start)

    const response = await app.request('/', json({ text: '   ' }))

    expect(response.status).toBe(400)
    expect(start).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })
})
