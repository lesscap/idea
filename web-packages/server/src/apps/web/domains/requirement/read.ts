import { notFound, sendOk } from '../../../../http.ts'
import { parsePageQuery } from '../../../../paging.ts'
import type { Controller } from '../../../../types.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { positiveId } from '../../services/scope/id.ts'
import { isResponse } from '../../services/scope/workspace.ts'

export const registerRequirementReads: Controller = app => {
  app.get('/', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const page = await app.$requirement.list(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      parsePageQuery(c.req.query()),
    )
    return sendOk(c, page)
  })

  app.get('/by-code/:code', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const found = await app.$requirement.byCode(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      c.req.param('code'),
    )
    return found ? sendOk(c, found) : notFound(c, 'requirement not found')
  })

  app.get('/:requirementId', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const requirementId = positiveId(c.req.param('requirementId'))
    if (requirementId === null) return notFound(c, 'requirement not found')
    const found = await app.$requirement.get(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      requirementId,
    )
    return found ? sendOk(c, found) : notFound(c, 'requirement not found')
  })

  app.get('/:requirementId/revisions/:revisionId', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const requirementId = positiveId(c.req.param('requirementId'))
    const revisionId = positiveId(c.req.param('revisionId'))
    if (requirementId === null || revisionId === null) {
      return notFound(c, 'requirement revision not found')
    }
    const found = await app.$requirement.revision(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      requirementId,
      revisionId,
    )
    return found ? sendOk(c, found) : notFound(c, 'requirement revision not found')
  })
}
