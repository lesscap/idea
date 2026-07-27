import type { Id, Role } from '@idea/shared'
import type { Context } from 'hono'
import { badRequest, forbidden, notFound } from '../../../http.ts'
import type { WebApplication } from '../../../types.ts'
import { session } from './session.ts'

export type WorkspaceAccess = {
  readonly workspaceId: Id
  readonly role: Role
}

// Resolves the caller's role in a workspace, or returns the Response to send.
//
// Non-members get 404, not 403. A 403 confirms the id exists, which is enough to
// enumerate workspaces one number at a time; 404 says nothing either way.
//
// This runs on EVERY request rather than trusting `session.workspaceId`. That
// value only records which workspace is currently selected — the user may have
// been removed from it since, and a cookie does not update itself.
export const requireMember = async (
  app: WebApplication,
  c: Context,
  workspaceId: Id,
): Promise<WorkspaceAccess | Response> => {
  const role = await app.workspace.roleOf(session(c).userId, workspaceId)
  return role === null ? notFound(c, 'workspace not found') : { workspaceId, role }
}

// Same, for the workspace currently selected in the session.
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
