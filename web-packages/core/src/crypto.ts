import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Password hashing, token minting, and token digesting — the pieces both the
// HTTP server and the seed script need, and neither of which has anything to do
// with HTTP.

// Current scrypt cost. Raise these as hardware gets faster; old hashes keep
// verifying because each one records the parameters it was made with.
const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64
const SALT_BYTES = 16

// "scrypt$N$r$p$saltHex$hashHex" — the parameters travel with the hash.
//
// Storing only "salt:hash" (as the reference implementation does) hides the
// parameters in the code, so the day you raise N you can no longer verify the
// existing rows: you don't know which cost produced them. The only way out at
// that point is forcing every user to reset their password. Recording them here
// makes raising the cost a non-event.
const FORMAT = 'scrypt'

// Per-user random salt, generated fresh for every hash. Two independent reasons,
// and the salt does NOT need to be secret for either — it only needs to be
// unique, which is why it is stored right next to the hash:
//
//  1. Without it, equal passwords produce equal hashes. A leaked database then
//     reveals which accounts share a password without any cracking at all, and
//     whoever knows one of them (their own account, say) has all of them.
//  2. Without it, one precomputed table attacks every row at once. With it, the
//     attacker must run the full slow hash separately per user, so cost scales
//     with the number of users instead of being amortised across them.
export const hashPassword = (password: string): string => {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P })
  return [FORMAT, N, R, P, salt.toString('hex'), hash.toString('hex')].join('$')
}

type Parsed = {
  readonly n: number
  readonly r: number
  readonly p: number
  readonly salt: Buffer
  readonly hash: Buffer
}

const parse = (stored: string): Parsed | null => {
  const parts = stored.split('$')
  if (parts.length !== 6) return null
  const [format, n, r, p, saltHex, hashHex] = parts
  if (format !== FORMAT || !n || !r || !p || !saltHex || !hashHex) return null
  const parsed = {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(saltHex, 'hex'),
    hash: Buffer.from(hashHex, 'hex'),
  }
  return Number.isFinite(parsed.n) && Number.isFinite(parsed.r) && Number.isFinite(parsed.p)
    ? parsed
    : null
}

// Re-derives with the parameters recorded in `stored`, not the current ones, so
// hashes written under an older cost still verify. Comparison is constant-time:
// a plain `===` leaks how many leading bytes matched, which is enough to forge a
// hash one byte at a time.
export const verifyPassword = (password: string, stored: string): boolean => {
  const parsed = parse(stored)
  if (!parsed) return false
  const actual = scryptSync(password, parsed.salt, parsed.hash.length, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
  })
  return parsed.hash.length === actual.length && timingSafeEqual(parsed.hash, actual)
}

// True when the hash was made with a weaker cost than we now use. Call it after
// a successful login and re-hash if it returns true — that migrates users to the
// stronger parameters silently, one login at a time, with no password reset.
export const needsRehash = (stored: string): boolean => {
  const parsed = parse(stored)
  return parsed === null || parsed.n < N || parsed.r < R || parsed.p < P
}

// 256 bits of randomness, URL-safe. Used for invite links, where the token *is*
// the capability — it has to be unguessable, and it has to survive being pasted
// into a chat message.
export const randomToken = (): string => randomBytes(32).toString('base64url')

// Invite tokens are stored as their digest, never in the clear, so a database
// leak yields no usable links. No salt here on purpose: we must be able to look
// a token up by its digest, and a 256-bit random input is not brute-forceable
// the way a human-chosen password is.
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')
