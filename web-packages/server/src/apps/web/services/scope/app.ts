import type { Context } from 'hono'
import { failWith } from '../../../../http.ts'
import type { AppRecord } from '../../../../services/app.ts'
import type { WebApplication } from '../../../../types.ts'
import { positiveId } from './id.ts'
import { isResponse, requireCurrentWorkspace } from './workspace.ts'

export type AppScopeResolver = (
  app: WebApplication,
  c: Context,
) => Promise<AppRecord | Response | null>

export const resolveProductAppScope: AppScopeResolver = async (app: WebApplication, c: Context) => {
  const access = await requireCurrentWorkspace(app, c)
  if (isResponse(access)) return access
  const appId = positiveId(c.req.param('appId'))
  return appId === null ? null : app.$app.getByIdInWorkspace(access.workspaceId, appId)
}

export const resolveWorkspaceAppScope: AppScopeResolver = async (app, c) => {
  const access = await requireCurrentWorkspace(app, c)
  if (isResponse(access)) return access
  const systemApp = await app.$app.getSystemInWorkspace(access.workspaceId)
  if (systemApp) return systemApp
  globalThis.console.error('workspace system app missing', { workspaceId: access.workspaceId })
  return failWith(c, 500, 'workspace_app_missing', 'workspace system app is missing')
}

export const scopedApp = resolveProductAppScope
