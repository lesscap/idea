import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { notFound } from '../../../../http.ts'
import type { Controller, WebApplication } from '../../../../types.ts'
import { session } from '../../middleware/session.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { positiveId } from '../../services/scope/id.ts'
import { isResponse } from '../../services/scope/workspace.ts'
import { sendIssueResult } from './result.ts'
import {
  CloseIssueBody,
  CreateIssueBody,
  SetIssueLabelsBody,
  SetIssueTypeBody,
  UpdateIssueBody,
} from './schema.ts'

type ScopedIssue = {
  readonly workspaceId: number
  readonly appId: number
  readonly issueNumber: number
}

const scopeIssue = async (app: WebApplication, c: Context): Promise<ScopedIssue | Response> => {
  const currentApp = await scopedApp(app, c)
  if (isResponse(currentApp)) return currentApp
  if (!currentApp) return notFound(c, 'app not found')
  const issueNumber = positiveId(c.req.param('number'))
  if (issueNumber === null) return notFound(c, 'issue not found')
  return { workspaceId: currentApp.workspaceId, appId: currentApp.id, issueNumber }
}

export const registerIssueWrites: Controller = app => {
  app.post('/', zValidator('json', CreateIssueBody), async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    return sendIssueResult(
      c,
      await app.$issue.create({
        workspaceId: currentApp.workspaceId,
        appId: currentApp.id,
        createdById: session(c).userId,
        ...c.req.valid('json'),
      }),
    )
  })

  app.patch('/:number', zValidator('json', UpdateIssueBody), async c => {
    const scope = await scopeIssue(app, c)
    if (isResponse(scope)) return scope
    return sendIssueResult(
      c,
      await app.$issue.update({
        ...scope,
        updatedById: session(c).userId,
        ...c.req.valid('json'),
      }),
    )
  })

  app.patch('/:number/type', zValidator('json', SetIssueTypeBody), async c => {
    const scope = await scopeIssue(app, c)
    if (isResponse(scope)) return scope
    return sendIssueResult(
      c,
      await app.$issue.setType({
        ...scope,
        actorId: session(c).userId,
        ...c.req.valid('json'),
      }),
    )
  })

  app.put('/:number/labels', zValidator('json', SetIssueLabelsBody), async c => {
    const scope = await scopeIssue(app, c)
    if (isResponse(scope)) return scope
    return sendIssueResult(
      c,
      await app.$issue.setLabels({
        ...scope,
        actorId: session(c).userId,
        ...c.req.valid('json'),
      }),
    )
  })

  app.post('/:number/close', zValidator('json', CloseIssueBody), async c => {
    const scope = await scopeIssue(app, c)
    if (isResponse(scope)) return scope
    return sendIssueResult(
      c,
      await app.$issue.close({
        ...scope,
        actorId: session(c).userId,
        closeReason: c.req.valid('json').reason,
      }),
    )
  })

  app.post('/:number/reopen', async c => {
    const scope = await scopeIssue(app, c)
    if (isResponse(scope)) return scope
    return sendIssueResult(c, await app.$issue.reopen({ ...scope, actorId: session(c).userId }))
  })
}
