import { useSession } from '@hono/session'
import type { Id } from '@idea/shared'
import type { Context, MiddlewareHandler } from 'hono'
import type { Config } from '../../../config.ts'
import { unauthorized } from '../../../http.ts'

// What the session cookie carries. Exactly the two things the rest of the app
// asks it: who is acting, and which workspace they are currently in.
export type SessionData = {
  userId: Id
  workspaceId: Id | null
}

// Eight hours absolute, extended while active. The absolute bound matters:
// @hono/session issues a cookie that never expires unless one is set, and with
// no server-side session store, the absolute lifetime IS the blast radius of a
// stolen cookie.
const ABSOLUTE_SECONDS = 8 * 60 * 60
const INACTIVITY_SECONDS = 30 * 60

export const sessionMiddleware = (config: Config): MiddlewareHandler =>
  useSession({
    secret: config.authSecret,
    duration: { absolute: ABSOLUTE_SECONDS, inactivity: INACTIVITY_SECONDS },
  })

// Reads the session once. Returns null when absent — callers decide whether
// that is a 401 or just "not logged in yet".
export const readSession = async (c: Context): Promise<SessionData | null> => {
  const data = (await c.var.session.get()) as SessionData | null
  return data?.userId ? data : null
}

const SESSION_KEY = 'idea:session'

// Resolves the session once per request and stashes it, so controllers read
// `session(c).userId` synchronously instead of repeating an await and a null
// check in every handler.
export const requireSession: MiddlewareHandler = async (c, next) => {
  const data = await readSession(c)
  if (!data) return unauthorized(c)
  c.set(SESSION_KEY, data)
  await next()
}

// Only valid downstream of requireSession.
export const session = (c: Context): SessionData => c.get(SESSION_KEY) as SessionData

export const startSession = async (c: Context, data: SessionData): Promise<void> => {
  await c.var.session.update(() => data)
}

export const endSession = (c: Context): void => {
  c.var.session.delete()
}
