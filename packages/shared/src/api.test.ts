import { describe, expect, it } from 'vitest'
import { fail, isOk, ok } from './api.ts'

// The envelope is the one contract both runtimes depend on: if `isOk` stops
// narrowing correctly, every consumer silently reads the wrong half.
describe('api envelope', () => {
  it('narrows a success response to its data', () => {
    const res = ok({ name: 'idea' })
    expect(isOk(res)).toBe(true)
    if (!isOk(res)) throw new Error('expected success')
    expect(res.data.name).toBe('idea')
  })

  it('narrows a failure response away from data', () => {
    const res = fail('not_found', 'missing')
    expect(isOk(res)).toBe(false)
    if (isOk(res)) throw new Error('expected failure')
    expect(res.code).toBe('not_found')
  })
})
