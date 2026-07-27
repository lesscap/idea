import { describe, expect, it, vi } from 'vitest'
import type { ServiceApplication } from '../../../types.ts'
import { json, mountController } from '../test-support.ts'
import { SessionController } from './session.ts'

const currentUser = {
  id: 1,
  username: 'zhang',
  name: '张三',
  phone: null,
  isPlatformAdmin: false,
}

const services = (over: Partial<ServiceApplication> = {}): Partial<ServiceApplication> => ({
  auth: { authenticate: async () => 1 },
  user: {
    currentUser: async () => currentUser,
    findByUsername: async () => null,
    isPlatformAdmin: async () => false,
    updatePasswordHash: async () => {},
  },
  workspace: { listForUser: async () => [], roleOf: async () => null } as never,
  ...over,
})

describe('POST /session (login)', () => {
  // The single most important property of this endpoint: an unknown username and
  // a wrong password must be indistinguishable, or it becomes a way to discover
  // who has an account.
  it('answers identically for a wrong password and an unknown username', async () => {
    const reject = { ...services(), auth: { authenticate: async () => null } }

    const wrongPassword = await mountController(SessionController, reject).request(
      '/',
      json({ username: 'zhang', password: 'wrong' }),
    )
    const unknownUser = await mountController(SessionController, reject).request(
      '/',
      json({ username: 'nobody', password: 'wrong' }),
    )

    expect(wrongPassword.status).toBe(unknownUser.status)
    expect(await wrongPassword.json()).toEqual(await unknownUser.json())
    expect(wrongPassword.status).toBe(401)
  })

  it('lowercases the username before authenticating', async () => {
    const authenticate = vi.fn(async () => 1)
    const app = mountController(SessionController, { ...services(), auth: { authenticate } })

    await app.request('/', json({ username: '  ZHANG  ', password: 'pw' }))

    expect(authenticate).toHaveBeenCalledWith('zhang', 'pw')
  })

  // A user in exactly one workspace should not be shown a "pick one" screen.
  it('preselects the only workspace', async () => {
    const app = mountController(SessionController, {
      ...services(),
      workspace: {
        listForUser: async () => [{ id: 7, name: 'w', createdAt: '', role: 'admin' }],
        roleOf: async () => null,
      } as never,
    })

    const body = (await (
      await app.request('/', json({ username: 'z', password: 'pw' }))
    ).json()) as {
      data: { workspaceId: number | null }
    }
    expect(body.data.workspaceId).toBe(7)
  })

  it('leaves the workspace unselected when there is more than one', async () => {
    const app = mountController(SessionController, {
      ...services(),
      workspace: {
        listForUser: async () => [
          { id: 7, name: 'a', createdAt: '', role: 'admin' },
          { id: 8, name: 'b', createdAt: '', role: 'member' },
        ],
        roleOf: async () => null,
      } as never,
    })

    const body = (await (
      await app.request('/', json({ username: 'z', password: 'pw' }))
    ).json()) as {
      data: { workspaceId: number | null }
    }
    expect(body.data.workspaceId).toBeNull()
  })
})

describe('GET /session', () => {
  it('rejects a request with no session', async () => {
    const res = await mountController(SessionController, services(), null).request('/')
    expect(res.status).toBe(401)
  })

  it('returns the current user when signed in', async () => {
    const app = mountController(SessionController, services(), { userId: 1, workspaceId: 3 })
    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: { user: currentUser, workspaceId: 3 },
    })
  })
})

describe('PATCH /session (switch workspace)', () => {
  // Membership is checked before the id enters the session. Skipping this would
  // let anyone put any workspace id into their own cookie.
  it('refuses a workspace the user does not belong to, as 404', async () => {
    const app = mountController(
      SessionController,
      {
        ...services(),
        workspace: { listForUser: async () => [], roleOf: async () => null } as never,
      },
      { userId: 1, workspaceId: null },
    )

    const res = await app.request('/', { ...json({ workspaceId: 99 }), method: 'PATCH' })

    // 404, not 403: a 403 would confirm that workspace 99 exists.
    expect(res.status).toBe(404)
  })

  it('accepts a workspace the user belongs to', async () => {
    const app = mountController(
      SessionController,
      {
        ...services(),
        workspace: { listForUser: async () => [], roleOf: async () => 'member' } as never,
      },
      { userId: 1, workspaceId: null },
    )

    const res = await app.request('/', { ...json({ workspaceId: 5 }), method: 'PATCH' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { workspaceId: 5 } })
  })
})

describe('DELETE /session (logout)', () => {
  // Logging out with an expired cookie must not 401 — that would leave a client
  // unable to clear a session it can no longer use.
  it('succeeds even when not signed in', async () => {
    const res = await mountController(SessionController, services(), null).request('/', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
  })
})
