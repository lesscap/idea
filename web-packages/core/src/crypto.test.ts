import { randomBytes, scryptSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashPassword, needsRehash, randomToken, sha256, verifyPassword } from './crypto.ts'

// Builds a hash at a deliberately low cost, the way an older release would have.
const weakHash = (password: string): string => {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, { N: 1024, r: 8, p: 1 })
  return ['scrypt', 1024, 8, 1, salt.toString('hex'), hash.toString('hex')].join('$')
}

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse battery staple')
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(verifyPassword('correct horse battery stapl', stored)).toBe(false)
  })

  // The symptom of a missing or shared salt. Without per-user salt these two are
  // byte-identical, and a leaked database then reveals which accounts share a
  // password with no cracking at all — knowing one of them is knowing all.
  it('produces different hashes for two users with the same password', () => {
    const a = hashPassword('same-password')
    const b = hashPassword('same-password')

    expect(a).not.toBe(b)
    expect(verifyPassword('same-password', a)).toBe(true)
    expect(verifyPassword('same-password', b)).toBe(true)
  })

  it('records the parameters it used', () => {
    expect(hashPassword('x').split('$').slice(0, 4)).toEqual(['scrypt', '16384', '8', '1'])
  })

  // Raising the cost must not lock existing users out: a hash written under a
  // weaker cost has to keep verifying, and be reported as due for a rehash.
  it('still verifies a hash written with weaker parameters', () => {
    const weak = weakHash('secret')

    expect(verifyPassword('secret', weak)).toBe(true)
    expect(needsRehash(weak)).toBe(true)
  })

  it('does not verify when the recorded parameters have been tampered with', () => {
    const tampered = hashPassword('secret').replace('scrypt$16384$', 'scrypt$1024$')
    expect(verifyPassword('secret', tampered)).toBe(false)
  })

  it('does not ask for a rehash at the current cost', () => {
    expect(needsRehash(hashPassword('x'))).toBe(false)
  })

  it('rejects malformed stored values instead of throwing', () => {
    expect(verifyPassword('x', '')).toBe(false)
    expect(verifyPassword('x', 'garbage')).toBe(false)
    expect(verifyPassword('x', 'scrypt$16384$8$1$deadbeef')).toBe(false)
  })
})

describe('tokens', () => {
  it('mints unguessable, url-safe tokens', () => {
    const token = randomToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(randomToken()).not.toBe(token)
  })

  it('digests deterministically so a token can be looked up by its hash', () => {
    expect(sha256('abc')).toBe(sha256('abc'))
    expect(sha256('abc')).not.toBe(sha256('abd'))
  })
})
