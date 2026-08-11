import type { RequirementDetail } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AppRecord, AppService } from '../../../../services/app.ts'
import type { RequirementService } from '../../../../services/requirement/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { failure, json, mountController, okData } from '../../test-support.ts'
import { RequirementsController } from './index.ts'

const stub = <T>(calls: Partial<T>): T => calls as T

const currentApp: AppRecord = {
  id: 5,
  workspaceId: 11,
  slug: 'leave-request',
  name: '请假申请',
  description: null,
  status: 'draft',
  createdById: 7,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
}

const detail: RequirementDetail = {
  id: 42,
  number: 3,
  code: 'R-3',
  status: 'draft',
  draft: {
    title: '审批规则',
    summary: '',
    body: '',
    images: [],
    attachments: [],
    version: 1,
    updatedAt: '2026-08-07T00:00:00.000Z',
    updatedInConversationCid: null,
  },
  currentRevision: null,
  revisions: [],
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
}

const mount = (requirement: Partial<RequirementService>) =>
  mountController(
    RequirementsController,
    {
      $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
      $app: stub<AppService>({ getByIdInWorkspace: async () => currentApp }),
      $requirement: stub<RequirementService>(requirement),
    },
    { userId: 7, workspaceId: 11 },
    { guarded: true, prefix: '/:appId/requirements' },
  )

describe('requirement writes', () => {
  it('creates a complete draft with normalized defaults and request scope', async () => {
    const create = vi.fn<RequirementService['create']>(async () => ({
      kind: 'ok',
      requirement: detail,
    }))
    const app = mount({ create })

    const response = await app.request('/5/requirements', json({ title: '  审批规则  ' }))

    expect(await okData(response)).toEqual(detail)
    expect(create).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      createdById: 7,
      title: '审批规则',
      summary: '',
      body: '',
      imageFids: [],
      attachmentFids: [],
    })
  })

  it('saves the whole draft and identifies the user making the change', async () => {
    const saveDraft = vi.fn<RequirementService['saveDraft']>(async () => ({
      kind: 'ok',
      requirement: detail,
    }))
    const app = mount({ saveDraft })

    const response = await app.request('/5/requirements/42/draft', {
      ...json({ title: '新版', summary: '摘要', body: '正文' }),
      method: 'PUT',
    })

    expect(response.status).toBe(200)
    expect(saveDraft).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      requirementId: 42,
      updatedById: 7,
      title: '新版',
      summary: '摘要',
      body: '正文',
      imageFids: [],
      attachmentFids: [],
    })
  })

  it('exposes stale confirmation as a stable conflict code', async () => {
    const confirm = vi.fn<RequirementService['confirm']>(async () => ({
      kind: 'draft_version_conflict',
    }))
    const app = mount({ confirm })

    const response = await app.request(
      '/5/requirements/42/revisions',
      json({ expectedDraftVersion: 2 }),
    )

    expect(response.status).toBe(409)
    expect((await failure(response)).code).toBe('draft_version_conflict')
    expect(confirm).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      requirementId: 42,
      confirmedById: 7,
      expectedDraftVersion: 2,
    })
  })

  it('rejects an empty title before calling the service', async () => {
    const create = vi.fn<RequirementService['create']>()
    const app = mount({ create })

    const response = await app.request('/5/requirements', json({ title: '   ' }))

    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects duplicate file references before calling the service', async () => {
    const create = vi.fn<RequirementService['create']>()
    const app = mount({ create })

    const response = await app.request(
      '/5/requirements',
      json({ title: '附件', imageFids: ['same'], attachmentFids: ['same'] }),
    )

    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('exposes invalid image files as a stable bad-request code', async () => {
    const create = vi.fn<RequirementService['create']>(async () => ({
      kind: 'invalid_image_file',
    }))
    const app = mount({ create })

    const response = await app.request(
      '/5/requirements',
      json({ title: '图片', imageFids: ['text-file'] }),
    )

    expect(response.status).toBe(400)
    expect((await failure(response)).code).toBe('invalid_requirement_image')
  })
})
