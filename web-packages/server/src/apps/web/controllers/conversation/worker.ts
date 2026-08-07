import { zValidator } from '@hono/zod-validator'
import { failWith, notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { AssignConversationWorkerBody } from '../../schema/index.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { isResponse } from '../../services/scope/workspace.ts'

export const registerWorkerAssignment: Controller = app => {
  app.patch('/:cid/worker', zValidator('json', AssignConversationWorkerBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const conversation = await app.$conversation.getByCid(currentApp.id, c.req.param('cid'))
    if (!conversation) return notFound(c, 'conversation not found')

    const worker = await app.$worker.getForWorkspace(
      currentApp.workspaceId,
      c.req.valid('json').workerId,
    )
    if (!worker) return failWith(c, 404, 'worker_not_found', 'worker not found')
    if (!worker.online) return failWith(c, 409, 'worker_offline', 'worker is offline')
    if (worker.providerId !== conversation.providerId)
      return failWith(c, 409, 'worker_provider_mismatch', 'worker uses another provider')

    if (conversation.workerId !== worker.id) {
      const assigned = await app.$conversation.assignWorker(conversation.id, worker.id)
      if (!assigned)
        return failWith(c, 409, 'conversation_running', 'conversation is currently running')
    }

    app.$commands.publish(worker.id, { type: 'work_available' })
    return sendOk(c, {
      providerId: conversation.providerId,
      worker: {
        id: worker.id,
        name: worker.name,
        hostname: worker.hostname,
        online: true,
      },
    })
  })
}
