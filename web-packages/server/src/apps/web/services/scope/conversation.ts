import type { Context } from 'hono'
import type { Conversation } from '../../../../services/conversation/index.ts'
import type { WebApplication } from '../../../../types.ts'
import { scopedApp } from './app.ts'
import { isResponse } from './workspace.ts'

// A missing response hides both an unknown conversation and one owned by a
// different app. Callers therefore cannot enumerate another tenant's ids.
export const scopedConversation = async (
  app: WebApplication,
  c: Context,
  cid: string,
): Promise<Conversation | Response | null> => {
  const currentApp = await scopedApp(app, c)
  if (isResponse(currentApp) || !currentApp) return currentApp
  return app.$conversation.getByCid(currentApp.id, cid)
}
