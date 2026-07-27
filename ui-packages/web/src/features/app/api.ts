import type { App, Id, Paged } from '@idea/shared'
import { get, patch, post } from '../../lib/request'

// No workspaceId anywhere: these all act on the workspace currently selected in
// the session, and the server re-checks membership on each call.

export const listApps = (page = 1): Promise<Paged<App>> => get<Paged<App>>(`/apps?page=${page}`)

export const createApp = (name: string, description?: string): Promise<App> =>
  post<App>('/apps', { name, description: description || null })

export const updateApp = (
  id: Id,
  patchBody: Partial<Pick<App, 'name' | 'description' | 'status'>>,
) => patch<App>(`/apps/${id}`, patchBody)
