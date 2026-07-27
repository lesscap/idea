// Normalization rules for the two identifiers users type by hand. Pure, and
// shared deliberately: the browser validates as you type and the server
// normalizes before writing, and they must agree — a rule that exists in only
// one of the two places is a rule that gets bypassed.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 32

// Names that would let someone impersonate the platform wherever a username is
// displayed. Cheap to block, and impossible to reclaim later once taken.
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'api',
  'support',
  'official',
  'help',
  'security',
  'idea',
  'null',
  'undefined',
])

export type UsernameError =
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'edge_symbol'
  | 'all_digits'
  | 'reserved'

export type Normalized<T, E> = { ok: true; value: T } | { ok: false; error: E }

// Lowercases before every check, so `Admin` is rejected as reserved and `Zhang`
// and `zhang` collapse to one account. Without this the unique constraint holds
// on bytes while failing at its actual job.
export const normalizeUsername = (raw: string): Normalized<string, UsernameError> => {
  const value = raw.trim().toLowerCase()

  // Character set is checked before length, so `张三` is told what is actually
  // wrong. Reporting "too short" there would send the user off to add more
  // characters, which fails again for the same unstated reason.
  if (value.length === 0) return { ok: false, error: 'too_short' }
  if (!/^[a-z0-9._-]+$/.test(value)) return { ok: false, error: 'invalid_chars' }
  if (/^[._-]|[._-]$/.test(value)) return { ok: false, error: 'edge_symbol' }
  if (value.length < USERNAME_MIN) return { ok: false, error: 'too_short' }
  if (value.length > USERNAME_MAX) return { ok: false, error: 'too_long' }
  // An all-digit username reads as a phone number wherever both are displayed,
  // and would make a future "log in with phone" ambiguous.
  if (/^\d+$/.test(value)) return { ok: false, error: 'all_digits' }
  if (RESERVED_USERNAMES.has(value)) return { ok: false, error: 'reserved' }

  return { ok: true, value }
}

export type PhoneError = 'too_short' | 'too_long' | 'invalid_chars'

const DEFAULT_COUNTRY_CODE = '86'

// Normalizes to E.164 (`+8613800138000`).
//
// Storing what the user typed would make `13800138000`, `138-0013-8000` and
// `+86 138 0013 8000` three different rows, which quietly voids the unique
// constraint — and "one number, one account" is exactly what SMS recovery will
// depend on.
//
// Validation stays loose on purpose: no carrier-prefix matching, because
// prefixes change faster than deployments and rejecting a real new number is
// worse than accepting a typo we cannot dial.
export const normalizePhone = (raw: string): Normalized<string, PhoneError> => {
  const trimmed = raw.trim()
  if (!/^[+\d\s()-]+$/.test(trimmed)) return { ok: false, error: 'invalid_chars' }

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  // A bare local number gets the default country code; anything already
  // international keeps what it has.
  const withCountry = hadPlus
    ? digits
    : digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > 11
      ? digits
      : `${DEFAULT_COUNTRY_CODE}${digits}`

  if (withCountry.length < 8) return { ok: false, error: 'too_short' }
  if (withCountry.length > 15) return { ok: false, error: 'too_long' } // E.164 max

  return { ok: true, value: `+${withCountry}` }
}
