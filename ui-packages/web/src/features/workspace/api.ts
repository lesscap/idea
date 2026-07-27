import type { CreatedInvite, Id, Role, WorkspaceMember, WorkspaceMembership } from '@idea/shared'
import { get, post } from '../../lib/request.ts'

export const listWorkspaces = (): Promise<WorkspaceMembership[]> =>
  get<WorkspaceMembership[]>('/workspaces')

export const createWorkspace = (name: string): Promise<WorkspaceMembership> =>
  post<WorkspaceMembership>('/workspaces', { name })

export const listMembers = (workspaceId: Id): Promise<WorkspaceMember[]> =>
  get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)

// The returned token is the only copy — the server stores just its digest.
export const createInvite = (workspaceId: Id, role: Role): Promise<CreatedInvite> =>
  post<CreatedInvite>(`/workspaces/${workspaceId}/invites`, { role })
