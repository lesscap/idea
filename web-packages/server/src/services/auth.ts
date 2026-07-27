import { hashPassword, needsRehash, verifyPassword } from '@idea/core'
import type { Id } from '@idea/shared'
import type { Service } from '../types.ts'

export type AuthService = {
  authenticate: (username: string, password: string) => Promise<Id | null>
}

// A hash of a throwaway password, computed once at module load. Used to spend
// the same work when the username does not exist as when it does — see below.
const DECOY_HASH = hashPassword('decoy-password-for-timing-equalisation')

export const createAuthService: Service<AuthService> = app => ({
  // Returns the user id, or null. Never says *why* it failed.
  //
  // When the username is unknown we still run a full scrypt verification against
  // a decoy hash. Without it, a missing user returns in microseconds while a
  // wrong password takes the full hashing cost, and that difference alone turns
  // this endpoint into a username enumerator — the caller learns who has an
  // account without ever guessing a password.
  authenticate: async (username, password) => {
    const user = await app.$user.findByUsername(username)

    if (!user) {
      verifyPassword(password, DECOY_HASH)
      return null
    }

    if (!verifyPassword(password, user.passwordHash)) return null

    // Successful login is the one moment we hold the plaintext, so it is the
    // only chance to migrate a hash written under weaker parameters. Silent,
    // one user at a time, no password reset.
    if (needsRehash(user.passwordHash)) {
      await app.$user.updatePasswordHash(user.id, hashPassword(password))
    }

    return user.id
  },
})
