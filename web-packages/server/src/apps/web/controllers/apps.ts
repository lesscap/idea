import { zValidator } from '@hono/zod-validator'
import type { App } from '@idea/shared'
import { failWith, notFound, sendOk } from '../../../http.ts'
import { parsePageQuery } from '../../../paging.ts'
import type { AppRecord } from '../../../services/app.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { CreateAppBody, UpdateAppBody } from '../schema/index.ts'
import { positiveId } from '../services/scope/id.ts'
import { isResponse, requireAdmin, requireCurrentWorkspace } from '../services/scope/workspace.ts'

const toPublicApp = ({
  id,
  slug,
  name,
  description,
  status,
  createdAt,
  updatedAt,
}: AppRecord): App => ({ id, slug, name, description, status, createdAt, updatedAt })

// Everything here is scoped to the workspace currently selected in the session,
// which is why no endpoint takes a workspaceId. Membership is re-checked on each
// request by requireCurrentWorkspace — the session records a selection, not a
// grant.
//
// Members can create and edit apps. Permanent deletion is narrower because it
// also removes every conversation in the app, so that operation requires an
// administrator below.
export const AppsController: Controller = app => {
  app.get('/', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const query = parsePageQuery(c.req.query())
    const page = await app.$app.listInWorkspace(access.workspaceId, query)
    return sendOk(c, { ...page, items: page.items.map(toPublicApp) })
  })

  app.post('/', zValidator('json', CreateAppBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const { name, slug, description } = c.req.valid('json')
    const created = await app.$app.create({
      workspaceId: access.workspaceId,
      slug,
      name,
      description: description ?? null,
      createdById: session(c).userId,
    })
    if (created.kind === 'name_taken') {
      return failWith(c, 409, 'app_name_taken', 'an app with that name already exists')
    }
    if (created.kind === 'slug_taken') {
      return failWith(c, 409, 'app_slug_taken', 'an app with that slug already exists')
    }
    return sendOk(c, toPublicApp(created.app))
  })

  app.get('/by-slug/:slug', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const found = await app.$app.getBySlugInWorkspace(access.workspaceId, c.req.param('slug'))
    // An app in someone else's workspace is reported as missing, not forbidden.
    return found ? sendOk(c, toPublicApp(found)) : notFound(c, 'app not found')
  })

  app.get('/:appId', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const id = positiveId(c.req.param('appId'))
    const found = id === null ? null : await app.$app.getByIdInWorkspace(access.workspaceId, id)
    return found ? sendOk(c, toPublicApp(found)) : notFound(c, 'app not found')
  })

  app.patch('/:appId', zValidator('json', UpdateAppBody), async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access

    const id = positiveId(c.req.param('appId'))
    if (id === null) return notFound(c, 'app not found')
    const patch = c.req.valid('json')
    const updated = await app.$app.update(access.workspaceId, id, {
      ...patch,
      description: patch.description === undefined ? undefined : (patch.description ?? null),
    })

    if (updated.kind === 'name_taken') {
      return failWith(c, 409, 'app_name_taken', 'an app with that name already exists')
    }
    if (updated.kind === 'slug_taken') {
      return failWith(c, 409, 'app_slug_taken', 'an app with that slug already exists')
    }
    return updated.kind === 'ok'
      ? sendOk(c, toPublicApp(updated.app))
      : notFound(c, 'app not found')
  })

  app.delete('/:appId', async c => {
    const access = await requireCurrentWorkspace(app, c)
    if (isResponse(access)) return access
    const denied = requireAdmin(c, access)
    if (denied) return denied

    const id = positiveId(c.req.param('appId'))
    if (id === null) return notFound(c, 'app not found')
    const removed = await app.$app.remove(access.workspaceId, id)
    if (removed.kind === 'busy') {
      return failWith(c, 409, 'app_busy', 'app has queued or running work')
    }
    return removed.kind === 'ok' ? sendOk(c, { removed: id }) : notFound(c, 'app not found')
  })
}
