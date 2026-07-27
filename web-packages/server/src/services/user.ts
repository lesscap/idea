import type { CurrentUser, Id } from '@idea/shared'
import type { Service } from '../types.ts'

// The server-side record: everything about a user including the password hash.
// It never leaves this layer — controllers receive `User` or `CurrentUser` from
// @idea/shared, neither of which has a field for it.
export type UserRecord = {
  readonly id: Id
  readonly username: string
  readonly name: string
  readonly phone: string | null
  readonly passwordHash: string
}

export type UserService = {
  findByUsername: (username: string) => Promise<UserRecord | null>
  currentUser: (userId: Id) => Promise<CurrentUser | null>
  isPlatformAdmin: (userId: Id) => Promise<boolean>
  updatePasswordHash: (userId: Id, passwordHash: string) => Promise<void>
}

// Explicit projection everywhere, never a bare findUnique: selecting whole rows
// is how a password hash ends up in a response body months from now.
const publicFields = { id: true, username: true, name: true } as const

export const createUserService: Service<UserService> = app => ({
  findByUsername: username =>
    app.$prisma.user.findUnique({
      where: { username },
      select: { ...publicFields, phone: true, passwordHash: true },
    }),

  currentUser: async userId => {
    const row = await app.$prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicFields, phone: true, platformAdmin: { select: { userId: true } } },
    })
    if (!row) return null
    const { platformAdmin, ...user } = row
    // Derived from the presence of a platform_admins row, not from a column.
    return { ...user, isPlatformAdmin: platformAdmin !== null }
  },

  isPlatformAdmin: async userId =>
    (await app.$prisma.platformAdmin.findUnique({
      where: { userId },
      select: { userId: true },
    })) !== null,

  updatePasswordHash: async (userId, passwordHash) => {
    await app.$prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  },
})
