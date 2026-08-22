import type { IssueDetail } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AppRecord, AppService } from '../../../../services/app.ts'
import type { IssueService } from '../../../../services/issue/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { failure, json, mountController, okData } from '../../test-support.ts'
import { IssuesController } from './index.ts'

const stub = <T>(calls: Partial<T>): T => calls as T
const currentApp: AppRecord = {
  id: 5,
  workspaceId: 11,
  slug: 'leave-request',
  name: '请假申请',
  description: null,
  status: 'active',
  createdById: 7,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
}
const detail: IssueDetail = {
  id: 42,
  number: 3,
  title: '审批规则',
  body: '',
  state: 'open',
  closeReason: null,
  type: null,
  labels: [],
  revisionNumber: 1,
  images: [],
  attachments: [],
  createdBy: { id: 7, name: 'tester' },
  updatedBy: { id: 7, name: 'tester' },
  closedBy: null,
  closedAt: null,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
}

const mount = (issue: Partial<IssueService>) =>
  mountController(
    IssuesController,
    {
      $workspace: stub<WorkspaceService>({ roleOf: async () => 'member' }),
      $app: stub<AppService>({ getByIdInWorkspace: async () => currentApp }),
      $issue: stub<IssueService>(issue),
    },
    { userId: 7, workspaceId: 11 },
    { guarded: true, prefix: '/:appId/issues' },
  )

describe('issue controller', () => {
  it('creates a normalized issue in the current app scope', async () => {
    const create = vi.fn<IssueService['create']>(async () => ({ kind: 'ok', issue: detail }))
    const app = mount({ create })

    const response = await app.request('/5/issues', json({ title: '  审批规则  ' }))

    expect(await okData(response)).toEqual(detail)
    expect(create).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      createdById: 7,
      title: '审批规则',
      body: '',
      type: null,
      labelIds: [],
      imageFids: [],
      attachmentFids: [],
    })
  })

  it('requires a close reason and sends it to the state command', async () => {
    const close = vi.fn<IssueService['close']>(async () => ({ kind: 'ok', issue: detail }))
    const app = mount({ close })

    expect((await app.request('/5/issues/3/close', json({}))).status).toBe(400)
    const response = await app.request('/5/issues/3/close', json({ reason: 'not_planned' }))

    expect(response.status).toBe(200)
    expect(close).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      issueNumber: 3,
      actorId: 7,
      closeReason: 'not_planned',
    })
  })

  it('rejects duplicate files and labels before calling the service', async () => {
    const create = vi.fn<IssueService['create']>()
    const app = mount({ create })
    const duplicateFiles = await app.request(
      '/5/issues',
      json({ title: '附件', imageFids: ['same'], attachmentFids: ['same'] }),
    )
    const duplicateLabels = await app.request(
      '/5/issues',
      json({ title: '标签', labelIds: [2, 2] }),
    )

    expect(duplicateFiles.status).toBe(400)
    expect(duplicateLabels.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('updates the complete edit form and exposes conflicts with a stable API code', async () => {
    const update = vi.fn<IssueService['update']>(async () => ({
      kind: 'update_conflict',
    }))
    const app = mount({ update })
    const response = await app.request('/5/issues/3', {
      ...json({
        title: '新版',
        body: '',
        type: 'feature',
        labelIds: [4],
        expectedUpdatedAt: detail.updatedAt,
      }),
      method: 'PATCH',
    })

    expect(response.status).toBe(409)
    expect((await failure(response)).code).toBe('issue_update_conflict')
    expect(update).toHaveBeenCalledWith({
      workspaceId: 11,
      appId: 5,
      issueNumber: 3,
      updatedById: 7,
      title: '新版',
      body: '',
      type: 'feature',
      labelIds: [4],
      imageFids: [],
      attachmentFids: [],
      expectedUpdatedAt: detail.updatedAt,
    })
  })
})
