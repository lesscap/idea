import { zValidator } from '@hono/zod-validator'
import { notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { ConfigureConversationModelBody } from '../../schema/index.ts'
import type { AppScopeResolver } from '../../services/scope/app.ts'
import { scopedConversation } from '../../services/scope/conversation.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import { toWireEvent } from '../../wire.ts'

export const registerModelConfiguration =
  (resolveApp: AppScopeResolver): Controller =>
  app => {
    app.patch('/:cid/model', zValidator('json', ConfigureConversationModelBody), async c => {
      const found = await scopedConversation(app, c, c.req.param('cid'), resolveApp)
      if (isResponse(found)) return found
      if (!found) return notFound(c, 'conversation not found')

      const input = c.req.valid('json')
      const stored = await app.$conversation.configureModel(found.id, input)
      return sendOk(c, {
        model: input.model,
        effort: input.effort,
        event: {
          id: stored.id,
          sequence: stored.sequence,
          createdAt: stored.createdAt,
          event: toWireEvent(stored.event),
        },
      })
    })
  }
