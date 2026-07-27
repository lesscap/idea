import { describe, expect, it } from 'vitest'
import type { ServiceApplication } from '../../../types.ts'
import { failure, json, mountController, okData } from '../test-support.ts'
import { WorkspacesController } from './workspaces.ts'

type Over = {
  isPlatformAdmin?: boolean
  roleOf?: 'admin' | 'member' | null
  setRoleOk?: boolean
  removeOk?: boolean
}

const services = ({
  isPlatformAdmin = false,
  roleOf = 'member',
  setRoleOk = true,
  removeOk = true,
}: Over = {}): Partial<ServiceApplication> => ({
  user: {
    isPlatformAdmin: async () => isPlatformAdmin,
    currentUser: async () => null,
    findByUsername: async () => null,
    updatePasswordHash: async () => {},
  },
  workspace: {
    listForUser: async () => [],
    roleOf: async () => roleOf,
    create: async name => ({ id: 9, name, createdAt: '', role: 'admin' }),
    members: async () => [],
    setRole: async () => setRoleOk,
    removeMember: async () => removeOk,
    createInvite: async () => ({ token: 'tok', expiresAt: '' }),
    previewInvite: async () => null,
    acceptAsNewUser: async () => ({ kind: 'invalid' }),
    acceptAsExistingUser: async () => ({ kind: 'invalid' }),
  },
})

const signedIn = { userId: 1, workspaceId: 1 }
const mount = (over?: Over) =>
  mountController(WorkspacesController, services(over), signedIn, { guarded: true })

describe('POST /workspaces', () => {
  // Creating a workspace belongs to no workspace, so no workspace role can
  // authorise it. Without the platform check, anyone holding one invite link
  // could spin up workspaces and invite the world in — which is exactly what
  // invite-only access is meant to prevent.
  it('refuses a non platform administrator', async () => {
    const res = await mount({ isPlatformAdmin: false }).request('/', json({ name: 'w' }))

    expect(res.status).toBe(403)
    expect((await failure(res)).code).toBe('forbidden')
  })

  it('allows a platform administrator and makes them admin of the result', async () => {
    const res = await mount({ isPlatformAdmin: true }).request('/', json({ name: 'w' }))

    expect(res.status).toBe(200)
    expect(await okData(res)).toMatchObject({ name: 'w', role: 'admin' })
  })
})

describe('workspace administration', () => {
  it('refuses invite creation by a plain member', async () => {
    const res = await mount({ roleOf: 'member' }).request('/1/invites', json({ role: 'member' }))
    expect(res.status).toBe(403)
  })

  it('allows invite creation by an admin', async () => {
    const res = await mount({ roleOf: 'admin' }).request('/1/invites', json({ role: 'member' }))

    expect(res.status).toBe(200)
    expect(await okData(res)).toMatchObject({ token: 'tok' })
  })

  // 404 rather than 403: a 403 would confirm the workspace exists, which is
  // enough to enumerate workspaces by walking ids.
  it('reports a workspace the caller does not belong to as missing', async () => {
    const res = await mount({ roleOf: null }).request('/42/members')

    expect(res.status).toBe(404)
    expect((await failure(res)).code).toBe('not_found')
  })

  // Losing the last admin leaves the data intact and nobody able to administer
  // it — only fixable by editing the database directly.
  it('refuses to demote the last administrator', async () => {
    const res = await mount({ roleOf: 'admin', setRoleOk: false }).request('/1/members/1', {
      ...json({ role: 'member' }),
      method: 'PATCH',
    })

    expect(res.status).toBe(409)
    expect((await failure(res)).message).toMatch(/last administrator/)
  })

  it('refuses to remove the last administrator', async () => {
    const res = await mount({ roleOf: 'admin', removeOk: false }).request('/1/members/1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(409)
  })

  it('allows removing a member when another administrator remains', async () => {
    const res = await mount({ roleOf: 'admin', removeOk: true }).request('/1/members/2', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
  })
})
