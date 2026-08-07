import type { PageQuery } from '@idea/shared'
import { describe, expect, it, vi } from 'vitest'
import { paged } from '../../../paging.ts'
import type { ServiceApplication } from '../../../types.ts'
import { failure, json, mountController, okData } from '../test-support.ts'
import { AppsController } from './apps.ts'

const anApp = {
  id: 1,
  workspaceId: 1,
  slug: 'expense-approval',
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
    getByIdInWorkspace: async () => anApp,
    getBySlugInWorkspace: async () => anApp,
    create: async () => ({ kind: 'ok', app: anApp }),
    update: async () => ({ kind: 'ok', app: anApp }),
    remove: async () => ({ kind: 'ok' }),
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

    const response = await app.request('/')

    expect(listInWorkspace).toHaveBeenCalledWith(42, expect.objectContaining({ page: 1 }))
    const data = await okData<{ items: unknown[] }>(response)
    expect(data.items).toEqual([
      {
        id: anApp.id,
        slug: anApp.slug,
        name: anApp.name,
        description: null,
        status: 'draft',
        createdAt: '',
        updatedAt: '',
      },
    ])
  })

  it('resolves the browser slug inside the selected workspace', async () => {
    const getBySlugInWorkspace = vi.fn(async () => anApp)
    const app = mountController(
      AppsController,
      services('member', { getBySlugInWorkspace }),
      { userId: 1, workspaceId: 42 },
      { guarded: true },
    )

    const response = await app.request('/by-slug/expense-approval')

    expect(response.status).toBe(200)
    expect(getBySlugInWorkspace).toHaveBeenCalledWith(42, 'expense-approval')
    expect(await okData(response)).toMatchObject({ id: anApp.id, slug: anApp.slug })
  })

  it('loads an app resource by id inside the selected workspace', async () => {
    const getByIdInWorkspace = vi.fn(async () => anApp)
    const app = mountController(
      AppsController,
      services('member', { getByIdInWorkspace }),
      { userId: 1, workspaceId: 42 },
      { guarded: true },
    )

    const response = await app.request('/1')

    expect(response.status).toBe(200)
    expect(getByIdInWorkspace).toHaveBeenCalledWith(42, 1)
    expect(await okData(response)).toMatchObject({ id: anApp.id, slug: anApp.slug })
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

    const res = await app.request('/', json({ name: '报销审批', slug: 'expense-approval' }))

    expect(res.status).toBe(200)
  })

  it('accepts a two-character slug and rejects a one-character slug', async () => {
    const app = mountController(
      AppsController,
      services('member'),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const accepted = await app.request('/', json({ name: 'AI', slug: 'ai' }))
    const rejected = await app.request('/', json({ name: 'A', slug: 'a' }))

    expect(accepted.status).toBe(200)
    expect(rejected.status).toBe(400)
  })

  it('reports a duplicate name as a conflict, not a crash', async () => {
    const app = mountController(
      AppsController,
      services('member', { create: async () => ({ kind: 'name_taken' }) }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/', json({ name: '报销审批', slug: 'expense-approval' }))

    expect(res.status).toBe(409)
    expect((await failure(res)).code).toBe('app_name_taken')
  })

  it('reports a duplicate slug separately from a duplicate name', async () => {
    const app = mountController(
      AppsController,
      services('member', { create: async () => ({ kind: 'slug_taken' }) }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/', json({ name: '另一个应用', slug: 'expense-approval' }))

    expect(res.status).toBe(409)
    expect((await failure(res)).code).toBe('app_slug_taken')
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
      services('member', { update: async () => ({ kind: 'not_found' }) }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/1', {
      ...json({ name: 'x' }),
      method: 'PATCH',
    })

    expect(res.status).toBe(404)
  })

  it('only lets workspace administrators delete an app', async () => {
    const remove = vi.fn(async () => ({ kind: 'ok' as const }))
    const memberApp = mountController(
      AppsController,
      services('member', { remove }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )
    const adminApp = mountController(
      AppsController,
      services('admin', { remove }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const denied = await memberApp.request('/1', { method: 'DELETE' })
    const removed = await adminApp.request('/1', { method: 'DELETE' })

    expect(denied.status).toBe(403)
    expect(remove).toHaveBeenCalledOnce()
    expect(removed.status).toBe(200)
    expect(remove).toHaveBeenCalledWith(1, 1)
    expect(await okData(removed)).toEqual({ removed: 1 })
  })

  it('reports active agent work as a specific deletion conflict', async () => {
    const app = mountController(
      AppsController,
      services('admin', { remove: async () => ({ kind: 'busy' }) }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/1', { method: 'DELETE' })

    expect(res.status).toBe(409)
    expect((await failure(res)).code).toBe('app_busy')
  })

  it('reports deleting an app outside the workspace as missing', async () => {
    const app = mountController(
      AppsController,
      services('admin', { remove: async () => ({ kind: 'not_found' }) }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/1', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('reports an invalid app id as missing without calling the service', async () => {
    const update = vi.fn()
    const app = mountController(
      AppsController,
      services('member', { update }),
      { userId: 1, workspaceId: 1 },
      { guarded: true },
    )

    const res = await app.request('/not-an-id', {
      ...json({ name: 'x' }),
      method: 'PATCH',
    })

    expect(res.status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })
})
