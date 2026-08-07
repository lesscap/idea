import type { RequirementSummary } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AppRecord, AppService } from '../../../../services/app.ts'
import type { RequirementService } from '../../../../services/requirement/index.ts'
import type { WorkspaceService } from '../../../../services/workspace.ts'
import { mountController, okData } from '../../test-support.ts'
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

const summary: RequirementSummary = {
  id: 42,
  number: 3,
  code: 'R-3',
  status: 'active',
  title: '审批规则',
  summary: '请假审批规则',
  currentRevisionCode: 'v2',
  hasDraft: false,
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

describe('requirement reads', () => {
  it('lists requirements inside the URL app with normalized pagination', async () => {
    const list = vi.fn(async () => ({ items: [summary], total: 1, page: 2, pageSize: 100 }))
    const app = mount({ list })

    const response = await app.request('/5/requirements?page=2&pageSize=500')

    expect(response.status).toBe(200)
    expect(await okData(response)).toEqual({ items: [summary], total: 1, page: 2, pageSize: 100 })
    expect(list).toHaveBeenCalledWith({ workspaceId: 11, appId: 5 }, { page: 2, pageSize: 100 })
  })

  it('resolves requirement codes inside the same app scope', async () => {
    const byCode = vi.fn(async () => ({ id: summary.id, code: summary.code }))
    const app = mount({ byCode })

    const response = await app.request('/5/requirements/by-code/R-3')

    expect(await okData(response)).toEqual({ id: 42, code: 'R-3' })
    expect(byCode).toHaveBeenCalledWith({ workspaceId: 11, appId: 5 }, 'R-3')
  })

  it('rejects a malformed id without querying the service', async () => {
    const get = vi.fn<RequirementService['get']>(async () => null)
    const app = mount({ get })

    const response = await app.request('/5/requirements/not-an-id')

    expect(response.status).toBe(404)
    expect(get).not.toHaveBeenCalled()
  })
})
