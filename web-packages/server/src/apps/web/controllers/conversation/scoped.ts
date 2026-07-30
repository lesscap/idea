import type { Context } from 'hono'
import type { AppRecord } from '../../../../services/app.ts'
import type { Conversation } from '../../../../services/conversation/index.ts'
import type { WebApplication } from '../../../../types.ts'
import { isResponse, requireCurrentWorkspace } from '../../middleware/workspace.ts'

export const scopedApp = async (
  app: WebApplication,
  c: Context,
): Promise<AppRecord | Response | null> => {
  const access = await requireCurrentWorkspace(app, c)
  if (isResponse(access)) return access
  return app.$app.getBySlugInWorkspace(access.workspaceId, c.req.param('slug') ?? '')
}

// Loads a conversation only if the app in the URL owns it.
//
// Absent rather than forbidden is deliberate: a 403 confirms the id exists,
// which is enough to walk the ids and learn how many conversations another
// workspace has. Every route here goes through this — the check being in one
// place is what stops a new route from quietly skipping it.
export const scopedConversation = async (
  app: WebApplication,
  c: Context,
  cid: string,
): Promise<Conversation | Response | null> => {
  const currentApp = await scopedApp(app, c)
  if (isResponse(currentApp) || !currentApp) return currentApp
  return app.$conversation.getByCid(currentApp.id, cid)
}

export { isResponse }
