import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { failWith, notFound, sendOk } from '../../../../http.ts'
import type { RequirementWriteResult } from '../../../../services/requirement/index.ts'
import type { Controller } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { positiveId } from '../../services/scope/id.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import {
  ConfirmRequirementBody,
  CreateRequirementBody,
  SaveRequirementDraftBody,
} from './schema.ts'

const sendResult = (c: Context, result: RequirementWriteResult): Response => {
  if (result.kind === 'ok') return sendOk(c, result.requirement)
  if (result.kind === 'not_found') return notFound(c, 'requirement not found')
  if (result.kind === 'conversation_not_found') {
    return failWith(c, 404, 'conversation_not_found', 'conversation not found')
  }
  if (result.kind === 'archived') {
    return failWith(c, 409, 'requirement_archived', 'requirement is archived')
  }
  if (result.kind === 'draft_missing') {
    return failWith(c, 409, 'requirement_draft_missing', 'requirement has no draft')
  }
  return failWith(c, 409, 'draft_version_conflict', 'requirement draft has changed')
}

export const registerRequirementWrites: Controller = app => {
  app.post('/', zValidator('json', CreateRequirementBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const input = c.req.valid('json')
    return sendResult(
      c,
      await app.$requirement.create({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        createdById: session(c).userId,
        ...input,
      }),
    )
  })

  app.put('/:requirementId/draft', zValidator('json', SaveRequirementDraftBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const requirementId = positiveId(c.req.param('requirementId'))
    if (requirementId === null) return notFound(c, 'requirement not found')
    const input = c.req.valid('json')
    return sendResult(
      c,
      await app.$requirement.saveDraft({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        requirementId,
        updatedById: session(c).userId,
        ...input,
      }),
    )
  })

  app.post('/:requirementId/revisions', zValidator('json', ConfirmRequirementBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const requirementId = positiveId(c.req.param('requirementId'))
    if (requirementId === null) return notFound(c, 'requirement not found')
    const input = c.req.valid('json')
    return sendResult(
      c,
      await app.$requirement.confirm({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        requirementId,
        confirmedById: session(c).userId,
        ...input,
      }),
    )
  })
}
