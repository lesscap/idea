import { describe, expect, it, vi } from 'vitest'
import type { ServiceApplication } from '../types.ts'
import { createWorkspaceService } from './workspace.ts'

// resolveEntryWorkspace decides where every sign-in lands, and its two failure
// modes are both silent: a remembered workspace the user was removed from, and
// a user who belongs to nowhere. Neither surfaces as an error — they surface as
// landing in the wrong place, or a blank screen.

type Stubs = {
  remembered?: number | null
  stillMember?: boolean
  firstWorkspace?: number | null
}

const service = ({ remembered = null, stillMember = true, firstWorkspace = null }: Stubs) => {
  const findUniquePreference = vi.fn(async () => (remembered === null ? null : { lastWorkspaceId: remembered }))
  const findUniqueMembership = vi.fn(async () =>
    stillMember && remembered !== null ? { workspaceId: remembered } : null,
  )
  const findFirst = vi.fn(async () =>
    firstWorkspace === null ? null : { workspaceId: firstWorkspace },
  )

  const app = {
    $prisma: {
      userPreference: { findUnique: findUniquePreference },
      userWorkspace: { findUnique: findUniqueMembership, findFirst },
    },
  } as unknown as ServiceApplication

  return { svc: createWorkspaceService(app), findFirst, findUniqueMembership }
}

describe('resolveEntryWorkspace', () => {
  it('uses the remembered workspace when the user is still a member', async () => {
    const { svc, findFirst } = service({ remembered: 7, stillMember: true, firstWorkspace: 3 })

    expect(await svc.resolveEntryWorkspace(1)).toBe(7)
    // The fallback query must not even run — otherwise a remembered workspace
    // would be silently overridden whenever it happened to differ.
    expect(findFirst).not.toHaveBeenCalled()
  })

  // The case the foreign key cannot catch: the workspace still exists, so the
  // reference stays valid, but the user was removed from it.
  it('falls back when the remembered workspace is no longer accessible', async () => {
    const { svc } = service({ remembered: 7, stillMember: false, firstWorkspace: 3 })

    expect(await svc.resolveEntryWorkspace(1)).toBe(3)
  })

  it('falls back when nothing has been remembered yet', async () => {
    const { svc } = service({ remembered: null, firstWorkspace: 3 })

    expect(await svc.resolveEntryWorkspace(1)).toBe(3)
  })

  // Belonging to no workspace is a real state — being removed from the last one.
  // It must resolve to null so the UI can explain, not throw or hang.
  it('returns null when the user belongs to no workspace', async () => {
    const { svc } = service({ remembered: null, firstWorkspace: null })

    expect(await svc.resolveEntryWorkspace(1)).toBeNull()
  })

  it('still falls back to null when the remembered one is inaccessible and there are no others', async () => {
    const { svc } = service({ remembered: 7, stillMember: false, firstWorkspace: null })

    expect(await svc.resolveEntryWorkspace(1)).toBeNull()
  })
})
