import type { PageQuery } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import { paged } from '../../../paging.ts'
import type { ServiceApplication } from '../../../types.ts'
import { failure, json, mountController } from '../test-support.ts'
import { AppsController } from './apps.ts'

const anApp = {
  id: 1,
  workspaceId: 1,
  name: '报销审批',
  description: null,
  status: 'draft' as const,
  createdById: 1,
  createdAt: '',
  updatedAt: '',
}

const services = (
  roleOf: 'admin' | 'member' | null,
  appOver: Partial<ServiceApplication['$app']> = {},
): Partial<ServiceApplication> => ({
  $workspace: { roleOf: async () => roleOf, listForUser: async () => [] } as never,
  $app: {
    listInWorkspace: async (_ws, q) => paged([anApp], 1, q),
    getInWorkspace: async () => anApp,
    create: async () => anApp,
    update: async () => anApp,
    ...appOver,
  },
})

describe('workspace scoping', () => {
  // Every read goes through the workspace currently selected in the session, and
  // membership is rechecked per request — the session records a selection, never
  // a grant, because a user can be removed after selecting it.
  it('reports apps in a workspace the caller has left as missing', async () => {
    const app = mountController(
      AppsController,
      services(null),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/')

    expect(res.status).toBe(404)
  })

  it('asks for a workspace when none is selected', async () => {
    const app = mountController(
      AppsController,
      services('member'),
      {
        userId: 1,
        workspaceId: null,
      },
      { guarded: true },
    )

    const res = await app.request('/')

    expect(res.status).toBe(400)
    expect((await failure(res)).message).toMatch(/no workspace selected/)
  })

  // The list must be scoped in the query itself, so the controller can never
  // pass a workspace the caller does not belong to.
  it('lists only the selected workspace', async () => {
    const listInWorkspace = vi.fn(async (_ws: number, q: PageQuery) => paged([anApp], 1, q))
    const app = mountController(
      AppsController,
      services('member', { listInWorkspace }),
      {
        userId: 1,
        workspaceId: 42,
      },
      { guarded: true },
    )

    await app.request('/')

    expect(listInWorkspace).toHaveBeenCalledWith(42, expect.objectContaining({ page: 1 }))
  })

  // pageSize reaches the database as a LIMIT, so an unclamped value is a free
  // full-table read.
  it('clamps an outrageous pageSize', async () => {
    const listInWorkspace = vi.fn(async (_ws: number, q: PageQuery) => paged([], 0, q))
    const app = mountController(
      AppsController,
      services('member', { listInWorkspace }),
      {
        userId: 1,
        workspaceId: 1,
      },
      { guarded: true },
    )

    await app.request('/?pageSize=999999')

    expect(listInWorkspace).toHaveBeenCalledWith(1, expect.objectContaining({ pageSize: 100 }))
  })
})

describe('app writes', () => {
  // Any member may create — the workspace is the trust boundary and a second
  // permission layer on App has no requirement behind it.
  it('lets a plain member create an app', async () => {
    const app = mountController(
      AppsController,
      services('member'),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/', json({ name: '报销审批' }))

    expect(res.status).toBe(200)
  })

  it('reports a duplicate name as a conflict, not a crash', async () => {
    const app = mountController(
      AppsController,
      services('member', { create: async () => 'name_taken' }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/', json({ name: '报销审批' }))

    expect(res.status).toBe(409)
  })

  it('rejects an empty patch rather than pretending it succeeded', async () => {
    const app = mountController(
      AppsController,
      services('member'),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/1', { ...json({}), method: 'PATCH' })

    expect(res.status).toBe(400)
  })

  it('reports updating an app outside the workspace as missing', async () => {
    const app = mountController(
      AppsController,
      services('member', { update: async () => null }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/1', { ...json({ name: 'x' }), method: 'PATCH' })

    expect(res.status).toBe(404)
  })
})
