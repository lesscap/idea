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

const workspaceStub = (over: Record<string, unknown> = {}) =>
  ({
    listForUser: async () => [],
    roleOf: async () => null,
    resolveEntryWorkspace: async () => null,
    rememberWorkspace: async () => {},
    ...over,
  }) as never

const services = (over: Partial<ServiceApplication> = {}): Partial<ServiceApplication> => ({
  $auth: { authenticate: async () => 1 },
  $user: {
    currentUser: async () => currentUser,
    findByUsername: async () => null,
    isPlatformAdmin: async () => false,
    updatePasswordHash: async () => {},
  },
  $workspace: workspaceStub(),
  ...over,
})

describe('POST /session (login)', () => {
  // The single most important property of this endpoint: an unknown username and
  // a wrong password must be indistinguishable, or it becomes a way to discover
  // who has an account.
  it('answers identically for a wrong password and an unknown username', async () => {
    const reject = { ...services(), $auth: { authenticate: async () => null } }

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
    const app = mountController(SessionController, { ...services(), $auth: { authenticate } })

    await app.request('/', json({ username: '  ZHANG  ', password: 'pw' }))

    expect(authenticate).toHaveBeenCalledWith('zhang', 'pw')
  })

  const loginWorkspaceId = async (workspaceStubOver: Record<string, unknown>) => {
    const app = mountController(SessionController, {
      ...services(),
      $workspace: workspaceStub(workspaceStubOver),
    })
    const body = (await (
      await app.request('/', json({ username: 'z', password: 'pw' }))
    ).json()) as { data: { workspaceId: number | null } }
    return body.data.workspaceId
  }

  // Signing in always lands somewhere. Being made to pick a workspace on every
  // login is friction for the overwhelmingly common case of returning to the
  // one you were last in.
  it('lands on whichever workspace the resolver picks', async () => {
    expect(await loginWorkspaceId({ resolveEntryWorkspace: async () => 7 })).toBe(7)
  })

  // The only case that legitimately has no workspace: the user belongs to none.
  // The UI shows an empty state rather than a picker with nothing in it.
  it('yields null only when the user belongs to no workspace', async () => {
    expect(await loginWorkspaceId({ resolveEntryWorkspace: async () => null })).toBeNull()
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
    const rememberWorkspace = vi.fn(async () => {})
    const app = mountController(
      SessionController,
      { ...services(), $workspace: workspaceStub({ roleOf: async () => null, rememberWorkspace }) },
      { userId: 1, workspaceId: null },
    )

    const res = await app.request('/', { ...json({ workspaceId: 99 }), method: 'PATCH' })

    // 404, not 403: a 403 would confirm that workspace 99 exists.
    expect(res.status).toBe(404)
    // And nothing is remembered — persisting a workspace the user cannot enter
    // would just produce a fallback on every future sign-in.
    expect(rememberWorkspace).not.toHaveBeenCalled()
  })

  it('accepts a workspace the user belongs to and remembers it', async () => {
    const rememberWorkspace = vi.fn(async () => {})
    const app = mountController(
      SessionController,
      {
        ...services(),
        $workspace: workspaceStub({ roleOf: async () => 'member', rememberWorkspace }),
      },
      { userId: 1, workspaceId: null },
    )

    const res = await app.request('/', { ...json({ workspaceId: 5 }), method: 'PATCH' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { workspaceId: 5 } })
    // Switching IS the statement "start me here next time".
    expect(rememberWorkspace).toHaveBeenCalledWith(1, 5)
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
