import { zValidator } from '@hono/zod-validator'
import { parsePageQuery } from '@idea/shared'
import { badRequest, conflict, notFound, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { isResponse, requireCurrentWorkspace } from '../middleware/workspace.ts'
import { CreateAppBody, UpdateAppBody } from '../schema/index.ts'

// Everything here is scoped to the workspace currently selected in the session,
// which is why no endpoint takes a workspaceId. Membership is re-checked on each
// request by requireCurrentWorkspace — the session records a selection, not a
// grant.
//
// No role checks: the workspace is the trust boundary, and everyone inside it is
// a colleague. Adding a second permission layer on App would be complexity with
// no requirement behind it.
export const AppsController: Controller = app => {
  app.get('/', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const query = parsePageQuery(c.req.query())
    return sendOk(c, await app.app.listInWorkspace(access.workspaceId, query))
  })

  app.post('/', zValidator('json', CreateAppBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const { name, description } = c.req.valid('json')
    const created = await app.app.create({
      workspaceId: access.workspaceId,
      name,
      description: description ?? null,
      createdById: session(c).userId,
    })
    return created === 'name_taken'
      ? conflict(c, 'an app with that name already exists in this workspace')
      : sendOk(c, created)
  })

  app.get('/:id', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return badRequest(c, 'invalid app id')

    const found = await app.app.getInWorkspace(access.workspaceId, id)
    // An app in someone else's workspace is reported as missing, not forbidden.
    return found ? sendOk(c, found) : notFound(c, 'app not found')
  })

  app.patch('/:id', zValidator('json', UpdateAppBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return badRequest(c, 'invalid app id')

    const patch = c.req.valid('json')
    const updated = await app.app.update(access.workspaceId, id, {
      ...patch,
      description: patch.description === undefined ? undefined : (patch.description ?? null),
    })

    if (updated === 'name_taken') {
      return conflict(c, 'an app with that name already exists in this workspace')
    }
    return updated ? sendOk(c, updated) : notFound(c, 'app not found')
  })
}
