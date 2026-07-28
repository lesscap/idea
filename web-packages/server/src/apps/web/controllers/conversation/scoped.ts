import type { Context } from 'hono'
import type { Conversation } from '../../../../services/conversation/index.ts'
import type { WebApplication } from '../../../../types.ts'
import { isResponse, requireCurrentWorkspace } from '../../middleware/workspace.ts'

// Loads a conversation only if the workspace currently selected in the session
// owns it.
//
// Absent rather than forbidden is deliberate: a 403 confirms the id exists,
// which is enough to walk the ids and learn how many conversations another
// workspace has. Every route here goes through this — the check being in one
// place is what stops a new route from quietly skipping it.
export const scopedConversation = async (
  app: WebApplication,
  c: Context,
  id: number,
): Promise<Conversation | Response | null> => {
  const access = await requireCurrentWorkspace(app, c)
  if (isResponse(access)) return access
  const conversation = await app.$conversation.get(id)
  return conversation && conversation.workspaceId === access.workspaceId ? conversation : null
}

export { isResponse }
