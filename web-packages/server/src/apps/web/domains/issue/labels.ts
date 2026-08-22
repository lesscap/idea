import { zValidator } from '@hono/zod-validator'
import { notFound, sendOk } from '../../../../http.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { positiveId } from '../../services/scope/id.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import { sendDeleteLabelResult, sendLabelResult } from './result.ts'
import { CreateLabelBody, UpdateLabelBody } from './schema.ts'

export const LabelsController: Controller = app => {
  app.get('/', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    return sendOk(
      c,
      await app.$issue.labels({ workspaceId: currentApp.workspaceId, appId: currentApp.id }),
    )
  })

  app.post('/', zValidator('json', CreateLabelBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    return sendLabelResult(
      c,
      await app.$issue.createLabel({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        ...c.req.valid('json'),
      }),
    )
  })

  app.patch('/:labelId', zValidator('json', UpdateLabelBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const labelId = positiveId(c.req.param('labelId'))
    if (labelId === null) return notFound(c, 'label not found')
    return sendLabelResult(
      c,
      await app.$issue.updateLabel({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        labelId,
        ...c.req.valid('json'),
      }),
    )
  })

  app.delete('/:labelId', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const labelId = positiveId(c.req.param('labelId'))
    if (labelId === null) return notFound(c, 'label not found')
    return sendDeleteLabelResult(
      c,
      await app.$issue.deleteLabel({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        labelId,
        actorId: session(c).userId,
      }),
    )
  })
}
