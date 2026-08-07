import type { Id, Role } from '@idea/shared'
import type { Context } from 'hono'
import { badRequest, forbidden, notFound } from '../../../../http.ts'
import type { WebApplication } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'

export type WorkspaceAccess = {
  readonly workspaceId: Id
  readonly role: Role
}

// Session state records a selection, not a lasting grant. Membership is
// resolved on every request so removing a user takes effect immediately.
export const requireMember = async (
  app: WebApplication,
  c: Context,
  workspaceId: Id,
): Promise<WorkspaceAccess | Response> => {
  const role = await app.$workspace.roleOf(session(c).userId, workspaceId)
  return role === null ? notFound(c, 'workspace not found') : { workspaceId, role }
}

export const requireCurrentWorkspace = async (
  app: WebApplication,
  c: Context,
): Promise<WorkspaceAccess | Response> => {
  const { workspaceId } = session(c)
  if (workspaceId === null) return badRequest(c, 'no workspace selected')
  return requireMember(app, c, workspaceId)
}

export const requireAdmin = (c: Context, access: WorkspaceAccess): Response | null =>
  access.role === 'admin' ? null : forbidden(c, 'workspace admin required')

export const isResponse = (value: unknown): value is Response => value instanceof Response
