import { describe, expect, it, vi } from 'vitest'
import type { CommandBus } from '../../../../command-bus.ts'
import type { AppRecord, AppService } from '../../../../services/app.ts'
import type { Conversation, ConversationService } from '../../../../services/conversation/index.ts'
import type { FileService } from '../../../../services/file.ts'
import type { PendingInputService } from '../../../../services/pending-input.ts'
import type { ProviderService } from '../../../../services/provider.ts'
import type { TurnService } from '../../../../services/turn.ts'
import type { WorkerOption, WorkerService } from '../../../../services/worker.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { failure, json, mountController, okData } from '../../test-support.ts'
import { ConversationsController, WorkspaceConversationsController } from './index.ts'

// Only the calls these two routes make are stubbed. A cast is unavoidable —
// each service type is a whole interface — but going through Partial<T> keeps
// the parts that ARE written honest: a misspelled method or a wrong signature
// still fails to compile, where a bare `as never` would swallow both.
const stub = <T>(calls: Partial<T>): T => calls as T

const created: Conversation = {
  id: 42,
  cid: 'abc123def456',
  appId: 5,
  providerId: 3,
  workerId: 7,
  providerSessionId: null,
  model: null,
  effort: null,
  title: null,
  lastActiveAt: '2026-07-28T00:00:00.000Z',
}

const worker: WorkerOption = {
  id: 7,
  workspaceId: 11,
  providerId: 3,
  machineId: 'machine-7',
  name: 'mac-mini',
  hostname: 'mini.local',
  online: true,
  providerLabel: 'GLM',
  providerKind: 'claude',
  defaultModel: 'glm-5.2',
  models: [],
  efforts: { 'glm-5.2': ['low'] },
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

const provider = {
  id: 3,
  name: 'glm',
  label: 'GLM',
  kind: 'claude',
  enabled: true,
  config: { model: 'glm-5.2', efforts: { 'glm-5.2': ['low'] } },
} as const

const mount = (
  conversation: Partial<ConversationService>,
  file: Partial<FileService> = {
    resolveAttachments: async () => ({ kind: 'ok', attachments: [] }),
  },
  pendingInput: Partial<PendingInputService> = { list: async () => [] },
  turn: Partial<TurnService> = { execution: async () => ({ state: 'idle' }) },
) => {
  const publish = vi.fn()
  const getByIdInWorkspace = vi.fn(async () => currentApp)
  return {
    app: mountController(
      ConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getByIdInWorkspace }),
        $conversation: stub<ConversationService>(conversation),
        $file: stub<FileService>(file),
        $pendingInput: stub<PendingInputService>(pendingInput),
        $provider: stub<ProviderService>({ get: async () => provider }),
        $turn: stub<TurnService>(turn),
        $worker: stub<WorkerService>({ getForWorkspace: async () => worker }),
        $commands: stub<CommandBus>({ publish }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/:appId/conversations' },
    ),
    getByIdInWorkspace,
    publish,
  }
}

describe('starting a conversation', () => {
  it('passes the first message into creation and announces the queued work', async () => {
    const start = vi.fn(async () => created)
    const { app, publish } = mount({ start })

    const response = await app.request(
      '/5/conversations',
      json({ text: '  第一条消息  ', workerId: worker.id }),
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
      providerId: worker.providerId,
      workerId: worker.id,
      defaultModel: worker.defaultModel,
      text: '第一条消息',
      attachments: [],
    })
    expect(publish).toHaveBeenCalledWith(worker.id, { type: 'work_available' })
  })

  it('starts from a ready attachment without requiring text', async () => {
    const start = vi.fn(async () => created)
    const attachment = {
      fid: 'file123',
      filename: 'brief.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 16,
    }
    const resolveAttachments = vi.fn().mockResolvedValue({ kind: 'ok', attachments: [attachment] })
    const { app } = mount({ start }, { resolveAttachments })

    const response = await app.request(
      '/5/conversations',
      json({ attachmentFids: [attachment.fid], workerId: worker.id }),
    )

    expect(response.status).toBe(200)
    expect(resolveAttachments).toHaveBeenCalledWith(currentApp.id, [attachment.fid])
    expect(start).toHaveBeenCalledWith({
      appId: currentApp.id,
      createdById: 7,
      providerId: worker.providerId,
      workerId: worker.id,
      defaultModel: worker.defaultModel,
      text: '',
      attachments: [attachment],
    })
  })

  it('rejects an empty first message before creating anything', async () => {
    const start = vi.fn()
    const { app, publish } = mount({ start })

    const response = await app.request('/5/conversations', json({ text: '   ' }))

    expect(response.status).toBe(400)
    expect(start).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('sending an attachment', () => {
  it('queues only the trusted descriptor resolved by the server', async () => {
    const attachment = {
      fid: 'file123',
      filename: 'brief.pdf',
      contentType: 'application/pdf',
      size: 16,
    }
    const resolveAttachments = vi.fn().mockResolvedValue({ kind: 'ok', attachments: [attachment] })
    const enqueue = vi.fn().mockResolvedValue({
      id: 9,
      text: '',
      attachments: [attachment],
      createdAt: '2026-08-05T00:00:00.000Z',
    })
    const { app } = mount(
      { getByCid: async () => created },
      { resolveAttachments },
      { enqueue, materialize: async () => null, list: async () => [] },
    )

    const response = await app.request(
      '/5/conversations/abc123def456/messages',
      json({ attachmentFids: [attachment.fid] }),
    )

    expect(response.status).toBe(200)
    expect(resolveAttachments).toHaveBeenCalledWith(created.appId, [attachment.fid])
    expect(enqueue).toHaveBeenCalledWith(created.id, { text: '', attachments: [attachment] })
  })
})

describe('stopping a running turn', () => {
  it('marks the turn and sends the abort command to its worker', async () => {
    const requestAbort = vi.fn().mockResolvedValue(91)
    const { app, publish } = mount({ getByCid: async () => created }, undefined, undefined, {
      requestAbort,
    })

    const response = await app.request('/5/conversations/abc123def456/abort', {
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(await okData(response)).toEqual({ requested: true })
    expect(requestAbort).toHaveBeenCalledWith(created.id)
    expect(publish).toHaveBeenCalledWith(created.workerId, { type: 'abort', turnId: 91 })
  })
})

describe('changing the conversation worker', () => {
  it('assigns an online worker with the same provider and wakes it', async () => {
    const assignWorker = vi.fn(async () => true)
    const { app, publish } = mount({ getByCid: async () => created, assignWorker })

    const response = await app.request('/5/conversations/abc123def456/worker', {
      ...json({ workerId: worker.id }),
      method: 'PATCH',
    })

    expect(response.status).toBe(200)
    expect(assignWorker).not.toHaveBeenCalled() // already assigned: idempotent
    expect(publish).toHaveBeenCalledWith(worker.id, { type: 'work_available' })
  })

  it('rejects reassignment while a turn is running', async () => {
    const replacement = { ...worker, id: 8, machineId: 'machine-8', name: 'replacement' }
    const assignWorker = vi.fn(async () => false)
    const publish = vi.fn()
    const app = mountController(
      ConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getByIdInWorkspace: async () => currentApp }),
        $conversation: stub<ConversationService>({
          getByCid: async () => created,
          assignWorker,
        }),
        $worker: stub<WorkerService>({ getForWorkspace: async () => replacement }),
        $commands: stub<CommandBus>({ publish }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/:appId/conversations' },
    )

    const response = await app.request('/5/conversations/abc123def456/worker', {
      ...json({ workerId: replacement.id }),
      method: 'PATCH',
    })

    expect(response.status).toBe(409)
    expect(assignWorker).toHaveBeenCalledWith(created.id, replacement.id)
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('conversation app scoping', () => {
  it('looks up cid inside the URL app and reports a mismatch as missing', async () => {
    const getByCid = vi.fn(async () => null)
    const { app, getByIdInWorkspace } = mount({ getByCid })

    const response = await app.request('/5/conversations/other-app/events')

    expect(response.status).toBe(404)
    expect(getByIdInWorkspace).toHaveBeenCalledWith(currentApp.workspaceId, currentApp.id)
    expect(getByCid).toHaveBeenCalledWith(currentApp.id, 'other-app')
  })

  it('returns live execution state beside the transcript window', async () => {
    const app = mountController(
      ConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getByIdInWorkspace: async () => currentApp }),
        $conversation: stub<ConversationService>({
          getByCid: async () => created,
          events: async () => [],
        }),
        $pendingInput: stub<PendingInputService>({ list: async () => [] }),
        $turn: stub<TurnService>({
          execution: async () => ({ state: 'queued' }),
        }),
        $worker: stub<WorkerService>({ getForWorkspace: async () => worker }),
        $provider: stub<ProviderService>({ get: async () => provider }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/:appId/conversations' },
    )

    const response = await app.request('/5/conversations/abc123def456/events')

    expect(await okData(response)).toEqual({
      items: [],
      pending: [],
      execution: { state: 'queued' },
      assignment: {
        providerId: created.providerId,
        worker: { id: 7, name: 'mac-mini', hostname: 'mini.local', online: true },
      },
      modelConfiguration: {
        kind: 'claude',
        defaultModel: 'glm-5.2',
        models: [],
        efforts: { 'glm-5.2': ['low'] },
        model: null,
        effort: null,
      },
    })
  })
})

describe('workspace conversation scoping', () => {
  it('resolves the hidden workspace app before listing conversations', async () => {
    const listForApp = vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 }))
    const app = mountController(
      WorkspaceConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getSystemInWorkspace: async () => currentApp }),
        $conversation: stub<ConversationService>({ listForApp }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/workspace/conversations' },
    )

    const response = await app.request('/workspace/conversations')
    expect(response.status).toBe(200)
    expect(listForApp).toHaveBeenCalledWith(currentApp.id, { page: 1, pageSize: 20 })
  })

  it('reports a missing system app as an observable server failure', async () => {
    const app = mountController(
      WorkspaceConversationsController,
      {
        $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
        $app: stub<AppService>({ getSystemInWorkspace: async () => null }),
      },
      { userId: 7, workspaceId: 11 },
      { guarded: true, prefix: '/workspace/conversations' },
    )

    const response = await app.request('/workspace/conversations')
    expect(response.status).toBe(500)
    expect((await failure(response)).code).toBe('workspace_app_missing')
  })
})
