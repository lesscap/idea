import { describe, expect, it } from 'vitest'
import { normalizePhone, normalizeUsername } from './identity.ts'

const username = (raw: string) => normalizeUsername(raw)
const phone = (raw: string) => normalizePhone(raw)

describe('normalizeUsername', () => {
  // The impersonation defence. Without lowercasing, `Zhang` and `zhang` are two
  // accounts that render identically in most UI.
  it('collapses case so two spellings cannot become two accounts', () => {
    expect(username('Zhang')).toEqual({ ok: true, value: 'zhang' })
    expect(username('ZHANG')).toEqual({ ok: true, value: 'zhang' })
  })

  it('trims surrounding whitespace', () => {
    expect(username('  zhang  ')).toEqual({ ok: true, value: 'zhang' })
  })

  it('rejects reserved names regardless of case', () => {
    expect(username('admin').ok).toBe(false)
    expect(username('Admin')).toEqual({ ok: false, error: 'reserved' })
    expect(username('ROOT')).toEqual({ ok: false, error: 'reserved' })
  })

  // An all-digit username is visually a phone number, which matters because
  // phone is the other identifier in this system.
  it('rejects an all-digit username', () => {
    expect(username('13800138000')).toEqual({ ok: false, error: 'all_digits' })
  })

  it('rejects characters outside the allowed set', () => {
    expect(username('zhang wei')).toEqual({ ok: false, error: 'invalid_chars' })
    expect(username('zhang@corp')).toEqual({ ok: false, error: 'invalid_chars' })
    expect(username('张三')).toEqual({ ok: false, error: 'invalid_chars' })
  })

  it('rejects leading or trailing symbols', () => {
    expect(username('_zhang')).toEqual({ ok: false, error: 'edge_symbol' })
    expect(username('zhang.')).toEqual({ ok: false, error: 'edge_symbol' })
  })

  it('enforces length bounds', () => {
    expect(username('ab')).toEqual({ ok: false, error: 'too_short' })
    expect(username('a'.repeat(33))).toEqual({ ok: false, error: 'too_long' })
  })

  it('accepts the ordinary shapes', () => {
    expect(username('zhang.wei').ok).toBe(true)
    expect(username('zhang_wei-01').ok).toBe(true)
  })
})

describe('normalizePhone', () => {
  // The whole point: three spellings of one number must land on one row, or the
  // unique constraint is decorative and SMS recovery has no anchor.
  it('maps every spelling of one number to the same value', () => {
    const expected = { ok: true, value: '+8613800138000' }
    expect(phone('13800138000')).toEqual(expected)
    expect(phone('138-0013-8000')).toEqual(expected)
    expect(phone('+86 138 0013 8000')).toEqual(expected)
    expect(phone('(138) 0013 8000')).toEqual(expected)
    expect(phone('  13800138000  ')).toEqual(expected)
  })

  it('keeps an explicit international prefix rather than doubling it', () => {
    expect(phone('+14155552671')).toEqual({ ok: true, value: '+14155552671' })
  })

  it('rejects letters and other junk', () => {
    expect(phone('138abc0000')).toEqual({ ok: false, error: 'invalid_chars' })
  })

  it('enforces E.164 length bounds', () => {
    expect(phone('123')).toEqual({ ok: false, error: 'too_short' })
    expect(phone(`+${'9'.repeat(16)}`)).toEqual({ ok: false, error: 'too_long' })
  })
})
