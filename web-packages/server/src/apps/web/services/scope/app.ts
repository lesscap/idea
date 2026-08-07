import type { Context } from 'hono'
import type { AppRecord } from '../../../../services/app.ts'
import type { WebApplication } from '../../../../types.ts'
import { positiveId } from './id.ts'
import { isResponse, requireCurrentWorkspace } from './workspace.ts'

export const scopedApp = async (
  app: WebApplication,
  c: Context,
): Promise<AppRecord | Response | null> => {
  const access = await requireCurrentWorkspace(app, c)
  if (isResponse(access)) return access
  const appId = positiveId(c.req.param('appId'))
  return appId === null ? null : app.$app.getByIdInWorkspace(access.workspaceId, appId)
}
