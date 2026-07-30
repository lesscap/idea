import type { App, Paged } from '@idea/shared'
import { get, patch, post } from '../../lib/request'

// No workspaceId anywhere: these all act on the workspace currently selected in
// the session, and the server re-checks membership on each call.

export const listApps = (page = 1): Promise<Paged<App>> => get<Paged<App>>(`/apps?page=${page}`)

export const getApp = (slug: string): Promise<App> => get<App>(`/apps/${encodeURIComponent(slug)}`)

export const createApp = (input: {
  name: string
  slug: string
  description?: string
}): Promise<App> => post<App>('/apps', { ...input, description: input.description || null })

export const updateApp = (
  currentSlug: string,
  patchBody: Partial<Pick<App, 'slug' | 'name' | 'description' | 'status'>>,
) => patch<App>(`/apps/${encodeURIComponent(currentSlug)}`, patchBody)
