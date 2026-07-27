import { zValidator } from '@hono/zod-validator'
import { notFound, sendOk, unauthorized } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { endSession, requireSession, session, startSession } from '../middleware/session.ts'
import { LoginBody, SelectWorkspaceBody } from '../schema/index.ts'

// The session as a resource: POST creates it, GET reads it, PATCH changes the
// selected workspace, DELETE ends it. Four verbs on one singular resource
// instead of four invented ones (/login, /logout, /me, /switch-workspace).
//
// NOTE: this controller is mounted WITHOUT `guarded`, because logging in cannot
// require being logged in. The three authenticated routes below apply
// `requireSession` individually. Do not wrap this whole controller in
// `guarded` — it would lock the login endpoint behind the session it issues.
export const SessionController: Controller = app => {
  // Login. Failure is deliberately uniform: unknown username and wrong password
  // return the identical code and message, and the auth service spends the same
  // hashing time on both. Anything else makes this an account enumerator.
  app.post('/', zValidator('json', LoginBody), async c => {
    const { username, password } = c.req.valid('json')

    const userId = await app.$auth.authenticate(username.trim().toLowerCase(), password)
    if (userId === null) return unauthorized(c, 'username or password is incorrect')

    // Always land somewhere: the workspace they used last, or their first if
    // there is no usable memory of one. Null only when they belong to none.
    const workspaceId = await app.$workspace.resolveEntryWorkspace(userId)

    await startSession(c, { userId, workspaceId })

    const user = await app.$user.currentUser(userId)
    return sendOk(c, { user, workspaceId })
  })

  app.get('/', requireSession, async c => {
    const { userId, workspaceId } = session(c)
    const user = await app.$user.currentUser(userId)
    // The session outlived the user row (deleted account, restored database).
    if (!user) {
      endSession(c)
      return unauthorized(c)
    }
    return sendOk(c, { user, workspaceId })
  })

  // Switching workspace is a field change on this resource, not a separate
  // action — which is the whole reason the session is modelled as a resource.
  app.patch('/', requireSession, zValidator('json', SelectWorkspaceBody), async c => {
    const { userId } = session(c)
    const { workspaceId } = c.req.valid('json')

    // Membership is verified before it goes into the session, and verified again
    // on every subsequent request. The session records a selection, never a
    // grant.
    const role = await app.$workspace.roleOf(userId, workspaceId)
    if (role === null) return notFound(c, 'workspace not found')

    await startSession(c, { userId, workspaceId })
    // Only after membership checks out — remembering a workspace the user
    // cannot enter would just produce a fallback on every future sign-in.
    await app.$workspace.rememberWorkspace(userId, workspaceId)
    return sendOk(c, { workspaceId })
  })

  // Idempotent, and deliberately not behind requireSession: logging out when
  // already logged out is the desired end state, not an error. Returning 401
  // here would strand a client whose cookie expired mid-session with no way to
  // clear it.
  app.delete('/', c => {
    endSession(c)
    return sendOk(c, { ok: true })
  })
}
