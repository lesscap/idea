import type { Id } from '../ids.ts'

// Three views of a user, with the boundaries drawn in the type system rather
// than left to whoever writes the next handler.

// What other people may see. No phone: it is PII, and a member list is the
// classic place it leaks from.
export type User = {
  readonly id: Id
  readonly username: string
  readonly name: string
}

// What you may see about yourself.
//
// `isPlatformAdmin` is derived from the presence of a platform_admins row, not
// a column on users — the wire shape does not have to mirror the table shape,
// and that freedom is exactly what keeps the users table about identity alone.
export type CurrentUser = User & {
  readonly phone: string | null
  readonly isPlatformAdmin: boolean
}

// UserRecord — CurrentUser plus passwordHash — deliberately does NOT live here.
// It stays server-side so a password hash has no type-level route into a
// response body.
