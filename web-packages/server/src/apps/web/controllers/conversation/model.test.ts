import type { StoredEvent } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AppService } from '../../../../services/app.ts'
import type { ConversationService } from '../../../../services/conversation/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { json, mountController, okData } from '../../test-support.ts'
import { ConversationsController } from './index.ts'

const stub = <T>(calls: Partial<T>): T => calls as T

const stored: StoredEvent = {
  id: 9,
  sequence: 3,
  createdAt: '2026-08-12T00:00:00.000Z',
  event: { type: 'system', action: 'model', model: 'future-model', effort: 'high' },
}

const mount = (configureModel: ConversationService['configureModel']) =>
  mountController(
    ConversationsController,
    {
      $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
      $app: stub<AppService>({
        getByIdInWorkspace: async () => ({
          id: 5,
          workspaceId: 11,
          slug: 'app',
          name: 'App',
          description: null,
          status: 'draft',
          createdById: 7,
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        }),
      }),
      $conversation: stub<ConversationService>({
        getByCid: async () => ({
          id: 42,
          cid: 'conversation-1',
          appId: 5,
          providerId: 3,
          workerId: 7,
          providerSessionId: null,
          model: null,
          effort: null,
          title: null,
          lastActiveAt: '2026-08-12T00:00:00.000Z',
        }),
        configureModel,
      }),
    },
    { userId: 7, workspaceId: 11 },
    { guarded: true, prefix: '/:appId/conversations' },
  )

describe('conversation model configuration', () => {
  it('accepts a free-form model with a supported effort', async () => {
    const configureModel = vi.fn(async () => stored)
    const response = await mount(configureModel).request('/5/conversations/conversation-1/model', {
      ...json({ model: 'future-model', effort: 'high' }),
      method: 'PATCH',
    })

    expect(response.status).toBe(200)
    expect(configureModel).toHaveBeenCalledWith(42, { model: 'future-model', effort: 'high' })
    expect(await okData(response)).toMatchObject({ model: 'future-model', effort: 'high' })
  })

  it('rejects an unsupported effort before changing state', async () => {
    const configureModel = vi.fn(async () => stored)
    const response = await mount(configureModel).request('/5/conversations/conversation-1/model', {
      ...json({ model: 'future-model', effort: 'ultra' }),
      method: 'PATCH',
    })

    expect(response.status).toBe(400)
    expect(configureModel).not.toHaveBeenCalled()
  })
})
