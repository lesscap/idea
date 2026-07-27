import { badRequest, conflict, notFound, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { readSession, startSession } from '../middleware/session.ts'
import { AcceptInviteBody } from '../schema/index.ts'

// Public on purpose: the token in the URL *is* the credential. Requiring a
// session here would make invitations useless — the people who need them do not
// have accounts yet.
export const InvitesController: Controller = app => {
  app.get('/:token', async c => {
    const preview = await app.workspace.previewInvite(c.req.param('token'))
    // Unknown, expired, and already-used all answer identically. Telling them
    // apart would let a link-holder probe for facts about other invitations.
    return preview ? sendOk(c, preview) : notFound(c, 'invitation is not valid')
  })

  app.post('/:token/accept', async c => {
    const token = c.req.param('token')
    const current = await readSession(c)

    // Someone who already has an account — being added to a second workspace —
    // joins as themselves. Without this branch they would be forced to invent a
    // duplicate account just to accept the invitation.
    if (current) {
      const result = await app.workspace.acceptAsExistingUser(token, current.userId)
      if (result.kind !== 'ok') return notFound(c, 'invitation is not valid')
      await startSession(c, { userId: current.userId, workspaceId: result.workspaceId })
      return sendOk(c, { workspaceId: result.workspaceId })
    }

    // New user: they choose their own username here, since the invitation never
    // knew who they were. Parsed by hand rather than with zValidator middleware
    // because the body is only required on this branch.
    const parsed = AcceptInviteBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? 'invalid request body')
    }
    const { username, password, name, phone } = parsed.data

    const result = await app.workspace.acceptAsNewUser(token, {
      username,
      password,
      name,
      phone: phone ?? null,
    })

    if (result.kind === 'invalid') return notFound(c, 'invitation is not valid')
    if (result.kind === 'username_taken') return conflict(c, 'that username is taken')

    await startSession(c, { userId: result.userId, workspaceId: result.workspaceId })
    return sendOk(c, { workspaceId: result.workspaceId })
  })
}
