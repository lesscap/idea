import { hashPassword, type Prisma, randomToken, sha256 } from '@idea/core'
import type {
  CreatedInvite,
  Id,
  InvitePreview,
  Role,
  WorkspaceMember,
  WorkspaceMembership,
} from '@idea/shared'
import type { Service } from '../types.ts'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AcceptResult =
  | { kind: 'ok'; userId: Id; workspaceId: Id }
  | { kind: 'invalid' } // unknown, expired, or already used — one answer for all three
  | { kind: 'username_taken' }

export type WorkspaceService = {
  listForUser: (userId: Id) => Promise<WorkspaceMembership[]>
  roleOf: (userId: Id, workspaceId: Id) => Promise<Role | null>
  // Which workspace to drop this user into on sign-in. Never throws; returns
  // null only when they belong to none.
  resolveEntryWorkspace: (userId: Id) => Promise<Id | null>
  rememberWorkspace: (userId: Id, workspaceId: Id) => Promise<void>
  create: (name: string, ownerId: Id) => Promise<WorkspaceMembership>
  members: (workspaceId: Id) => Promise<WorkspaceMember[]>
  setRole: (workspaceId: Id, userId: Id, role: Role) => Promise<boolean>
  removeMember: (workspaceId: Id, userId: Id) => Promise<boolean>
  createInvite: (workspaceId: Id, invitedById: Id, role: Role) => Promise<CreatedInvite>
  previewInvite: (token: string) => Promise<InvitePreview | null>
  acceptAsNewUser: (
    token: string,
    input: { username: string; password: string; name: string; phone: string | null },
  ) => Promise<AcceptResult>
  acceptAsExistingUser: (token: string, userId: Id) => Promise<AcceptResult>
}

export const createWorkspaceService: Service<WorkspaceService> = app => {
  // Loads a usable invite or null. Unknown, expired, and already-accepted all
  // collapse to null on purpose: distinguishing them tells a link-holder things
  // about invites they do not hold.
  const usableInvite = async (token: string) => {
    const invite = await app.$prisma.invite.findUnique({
      where: { tokenHash: sha256(token) },
      include: { workspace: { select: { name: true } }, invitedBy: { select: { name: true } } },
    })
    if (!invite) return null
    if (invite.acceptedAt !== null) return null
    if (invite.expiresAt.getTime() <= Date.now()) return null
    return invite
  }

  return {
    listForUser: async userId => {
      const rows = await app.$prisma.userWorkspace.findMany({
        where: { userId },
        select: {
          role: true,
          workspace: { select: { id: true, name: true, createdAt: true } },
        },
        orderBy: { workspace: { name: 'asc' } },
      })
      return rows.map(r => ({
        id: r.workspace.id,
        name: r.workspace.name,
        createdAt: r.workspace.createdAt.toISOString(),
        role: r.role,
      }))
    },

    // The single source of truth for "may this user touch this workspace".
    // Returns null for non-members, which callers turn into a 404.
    roleOf: async (userId, workspaceId) => {
      const row = await app.$prisma.userWorkspace.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { role: true },
      })
      return row?.role ?? null
    },

    // Resolution order: remembered workspace, then first available, then none.
    //
    // The remembered id is re-checked against membership rather than trusted.
    // Its foreign key only proves the workspace still exists — someone removed
    // from a workspace keeps a preference row pointing at a place they can no
    // longer enter, and that is a normal state, not corruption.
    resolveEntryWorkspace: async userId => {
      const remembered = await app.$prisma.userPreference.findUnique({
        where: { userId },
        select: { lastWorkspaceId: true },
      })

      if (remembered?.lastWorkspaceId != null) {
        const stillMember = await app.$prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: { userId, workspaceId: remembered.lastWorkspaceId },
          },
          select: { workspaceId: true },
        })
        if (stillMember) return stillMember.workspaceId
      }

      // Ordered by name so the fallback is stable rather than whatever the
      // database happens to return first.
      const first = await app.$prisma.userWorkspace.findFirst({
        where: { userId },
        select: { workspaceId: true },
        orderBy: { workspace: { name: 'asc' } },
      })
      return first?.workspaceId ?? null
    },

    // Switching workspace IS the statement "this is where I want to start next
    // time" — no separate "remember me" affordance needed. Callers must verify
    // membership before calling this.
    rememberWorkspace: async (userId, workspaceId) => {
      await app.$prisma.userPreference.upsert({
        where: { userId },
        create: { userId, lastWorkspaceId: workspaceId },
        update: { lastWorkspaceId: workspaceId },
      })
    },

    create: async (name, ownerId) => {
      const ws = await app.$prisma.workspace.create({
        data: { name, users: { create: { userId: ownerId, role: 'admin' } } },
        select: { id: true, name: true, createdAt: true },
      })
      return { ...ws, createdAt: ws.createdAt.toISOString(), role: 'admin' }
    },

    members: async workspaceId => {
      const rows = await app.$prisma.userWorkspace.findMany({
        where: { workspaceId },
        // No phone: this is the list other members see, and a phone number here
        // is the most likely way PII leaks out of this system.
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, username: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map(r => ({ ...r.user, role: r.role, joinedAt: r.createdAt.toISOString() }))
    },

    // Both member-mutating operations refuse to strand a workspace without an
    // administrator. Losing the last admin leaves the data intact but nobody
    // able to invite, promote, or delete — recoverable only by editing the
    // database by hand.
    setRole: async (workspaceId, userId, role) => {
      if (role !== 'admin' && (await isLastAdmin(workspaceId, userId))) return false
      await app.$prisma.userWorkspace.update({
        where: { userId_workspaceId: { userId, workspaceId } },
        data: { role },
      })
      return true
    },

    removeMember: async (workspaceId, userId) => {
      if (await isLastAdmin(workspaceId, userId)) return false
      await app.$prisma.userWorkspace.delete({
        where: { userId_workspaceId: { userId, workspaceId } },
      })
      return true
    },

    createInvite: async (workspaceId, invitedById, role) => {
      const token = randomToken()
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
      await app.$prisma.invite.create({
        // Only the digest is stored, so the link below is the one and only copy.
        data: { workspaceId, invitedById, role, tokenHash: sha256(token), expiresAt },
      })
      return { token, expiresAt: expiresAt.toISOString() }
    },

    previewInvite: async token => {
      const invite = await usableInvite(token)
      if (!invite) return null
      return {
        workspaceName: invite.workspace.name,
        role: invite.role,
        invitedByName: invite.invitedBy.name,
        expiresAt: invite.expiresAt.toISOString(),
      }
    },

    acceptAsNewUser: async (token, input) => {
      const invite = await usableInvite(token)
      if (!invite) return { kind: 'invalid' }

      const taken = await app.$prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      })
      if (taken) return { kind: 'username_taken' }

      // One transaction covering create-user, join, and spend-invite. A partial
      // result here is an account that exists but belongs to no workspace, or an
      // invite burned without letting anyone in.
      try {
        const userId = await app.$prisma.$transaction(async tx => {
          const user = await tx.user.create({
            data: {
              username: input.username,
              name: input.name,
              phone: input.phone,
              // Hashed here, at the only point that touches the plaintext.
              // Taking a pre-hashed value as a parameter would make it possible
              // for a caller to pass the raw password by mistake.
              passwordHash: hashPassword(input.password),
            },
            select: { id: true },
          })
          await tx.userWorkspace.create({
            data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
          })
          await spend(tx, invite.id, user.id)
          return user.id
        })
        return { kind: 'ok', userId, workspaceId: invite.workspaceId }
      } catch {
        // Lost the race on the username (or phone) unique constraint between the
        // check above and the insert.
        return { kind: 'username_taken' }
      }
    },

    acceptAsExistingUser: async (token, userId) => {
      const invite = await usableInvite(token)
      if (!invite) return { kind: 'invalid' }

      await app.$prisma.$transaction(async tx => {
        // Already a member: joining again must not fail or downgrade an existing
        // admin to the invite's role.
        const existing = await tx.userWorkspace.findUnique({
          where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
        })
        if (!existing) {
          await tx.userWorkspace.create({
            data: { userId, workspaceId: invite.workspaceId, role: invite.role },
          })
        }
        await spend(tx, invite.id, userId)
      })

      return { kind: 'ok', userId, workspaceId: invite.workspaceId }
    },
  }

  // Marks the invite used. Guarded on acceptedAt still being null so two
  // simultaneous accepts cannot both succeed — the second updates zero rows and
  // throws, rolling its transaction back.
  async function spend(tx: Prisma.TransactionClient, inviteId: Id, userId: Id) {
    const { count } = await tx.invite.updateMany({
      where: { id: inviteId, acceptedAt: null },
      data: { acceptedAt: new Date(), acceptedById: userId },
    })
    if (count === 0) throw new Error('invite already accepted')
  }

  async function isLastAdmin(workspaceId: Id, userId: Id): Promise<boolean> {
    const target = await app.$prisma.userWorkspace.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    })
    if (target?.role !== 'admin') return false
    const admins = await app.$prisma.userWorkspace.count({ where: { workspaceId, role: 'admin' } })
    return admins <= 1
  }
}
