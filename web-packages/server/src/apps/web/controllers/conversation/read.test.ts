import { describe, expect, it, vi } from 'vitest'
import type { ServiceApplication } from '../../../../types.ts'
import { json, mountController } from '../../test-support.ts'
import { ConversationsController } from './index.ts'

const mount = (start: ServiceApplication['$conversation']['start']) => {
  const broadcast = vi.fn()
  return {
    app: mountController(
      ConversationsController,
      {
        $workspace: { roleOf: async () => 'member' } as never,
        $conversation: { start } as never,
        $commands: { broadcast } as never,
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true },
    ),
    broadcast,
  }
}

describe('starting a conversation', () => {
  it('passes the first message into creation and announces the queued work', async () => {
    const start = vi.fn(async () => ({ id: 42 }) as never)
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
