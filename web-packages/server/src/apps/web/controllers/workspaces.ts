import { zValidator } from '@hono/zod-validator'
import { badRequest, conflict, forbidden, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { isResponse, requireAdmin, requireMember } from '../middleware/workspace.ts'
import { CreateInviteBody, CreateWorkspaceBody, SetRoleBody } from '../schema/index.ts'

const workspaceId = (c: { req: { param: (k: string) => string | undefined } }): number =>
  Number(c.req.param('id'))

export const WorkspacesController: Controller = app => {
  app.get('/', async c => sendOk(c, await app.workspace.listForUser(session(c).userId)))

  // Creating a workspace belongs to no workspace — at that moment none exists —
  // so it cannot be authorised by a workspace role. It is the one platform-level
  // capability, and it grants no visibility: the creator sees the new workspace
  // because they are made a member of it, not because they are a platform admin.
  app.post('/', zValidator('json', CreateWorkspaceBody), async c => {
    const { userId } = session(c)
    if (!(await app.user.isPlatformAdmin(userId))) {
      return forbidden(c, 'creating workspaces requires a platform administrator')
    }
    const { name } = c.req.valid('json')
    return sendOk(c, await app.workspace.create(name, userId))
  })

  app.get('/:id/members', async c => {
    const access = await requireMember(app, c, workspaceId(c))
    if (isResponse(access)) return access
    return sendOk(c, await app.workspace.members(access.workspaceId))
  })

  // The invite link is returned exactly once. Only its SHA-256 is stored, so
  // there is no way to show it again — the UI has to say so.
  app.post('/:id/invites', zValidator('json', CreateInviteBody), async c => {
    const access = await requireMember(app, c, workspaceId(c))
    if (isResponse(access)) return access
    const denied = requireAdmin(c, access)
    if (denied) return denied

    const { role } = c.req.valid('json')
    return sendOk(c, await app.workspace.createInvite(access.workspaceId, session(c).userId, role))
  })

  app.patch('/:id/members/:userId', zValidator('json', SetRoleBody), async c => {
    const access = await requireMember(app, c, workspaceId(c))
    if (isResponse(access)) return access
    const denied = requireAdmin(c, access)
    if (denied) return denied

    const target = Number(c.req.param('userId'))
    const { role } = c.req.valid('json')

    const ok = await app.workspace.setRole(access.workspaceId, target, role)
    // Refused because it would demote the last administrator, leaving the
    // workspace with data, members, and nobody able to manage any of it.
    return ok
      ? sendOk(c, { userId: target, role })
      : conflict(c, 'cannot demote the last administrator')
  })

  app.delete('/:id/members/:userId', async c => {
    const access = await requireMember(app, c, workspaceId(c))
    if (isResponse(access)) return access
    const denied = requireAdmin(c, access)
    if (denied) return denied

    const target = Number(c.req.param('userId'))
    if (!Number.isFinite(target)) return badRequest(c, 'invalid user id')

    const ok = await app.workspace.removeMember(access.workspaceId, target)
    return ok ? sendOk(c, { removed: target }) : conflict(c, 'cannot remove the last administrator')
  })
}
