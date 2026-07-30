import { describe, expect, it, vi } from 'vitest'
import type { CommandBus } from '../../../../command-bus.ts'
import type { AppRecord, AppService } from '../../../../services/app.ts'
import type { Conversation, ConversationService } from '../../../../services/conversation/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { json, mountController, okData } from '../../test-support.ts'
import { ConversationsController } from './index.ts'

// Only the calls these two routes make are stubbed. A cast is unavoidable —
// each service type is a whole interface — but going through Partial<T> keeps
// the parts that ARE written honest: a misspelled method or a wrong signature
// still fails to compile, where a bare `as never` would swallow both.
const stub = <T>(calls: Partial<T>): T => calls as T

const created: Conversation = {
  id: 42,
  cid: 'abc123def456',
  appId: 5,
  agentKind: null,
  providerSessionId: null,
  title: null,
  lastActiveAt: '2026-07-28T00:00:00.000Z',
}

const currentApp: AppRecord = {
  id: 5,
  workspaceId: 11,
  slug: 'leave-request',
  name: '请假申请',
  description: null,
  status: 'draft',
  createdById: 7,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
}

const mount = (conversation: Partial<ConversationService>) => {
  const broadcast = vi.fn()
  return {
    app: mountController(
      ConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getBySlugInWorkspace: async () => currentApp }),
        $conversation: stub<ConversationService>(conversation),
        $commands: stub<CommandBus>({ broadcast }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/:slug/conversations' },
    ),
    broadcast,
  }
}

describe('starting a conversation', () => {
  it('passes the first message into creation and announces the queued work', async () => {
    const start = vi.fn(async () => created)
    const { app, broadcast } = mount({ start })

    const response = await app.request(
      '/leave-request/conversations',
      json({ text: '  第一条消息  ' }),
    )

    expect(response.status).toBe(200)
    expect(await okData(response)).toEqual({
      cid: created.cid,
      title: null,
      lastActiveAt: created.lastActiveAt,
    })
    expect(start).toHaveBeenCalledWith({
      appId: 5,
      createdById: 7,
      text: '第一条消息',
    })
    expect(broadcast).toHaveBeenCalledWith({ type: 'work_available' })
  })

  it('rejects an empty first message before creating anything', async () => {
    const start = vi.fn()
    const { app, broadcast } = mount({ start })

    const response = await app.request('/leave-request/conversations', json({ text: '   ' }))

    expect(response.status).toBe(400)
    expect(start).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })
})

describe('conversation app scoping', () => {
  it('looks up cid inside the URL app and reports a mismatch as missing', async () => {
    const getByCid = vi.fn(async () => null)
    const { app } = mount({ getByCid })

    const response = await app.request('/leave-request/conversations/other-app/events')

    expect(response.status).toBe(404)
    expect(getByCid).toHaveBeenCalledWith(currentApp.id, 'other-app')
  })
})
