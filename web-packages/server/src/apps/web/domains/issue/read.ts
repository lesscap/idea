import { badRequest, notFound, sendOk } from '../../../../http.ts'
import { parsePageQuery } from '../../../../paging.ts'
import type { Controller } from '../../../../types.ts'
import { scopedApp } from '../../services/scope/app.ts'
import { positiveId } from '../../services/scope/id.ts'
import { isResponse } from '../../services/scope/workspace.ts'

const issueTypes = ['bug', 'feature', 'task'] as const
const issueStates = ['open', 'closed'] as const

const parseLabels = (value: string | undefined): readonly number[] | null => {
  if (!value) return []
  const parsed = value.split(',').map(part => positiveId(part.trim()))
  return parsed.some(id => id === null) ? null : (parsed as readonly number[])
}

export const registerIssueReads: Controller = app => {
  app.get('/', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const rawState = c.req.query('state') ?? 'open'
    const rawType = c.req.query('type')
    const state = issueStates.find(candidate => candidate === rawState)
    const type = issueTypes.find(candidate => candidate === rawType)
    const labelIds = parseLabels(c.req.query('labels'))
    if (!state) return badRequest(c, 'invalid issue state')
    if (rawType && !type) return badRequest(c, 'invalid issue type')
    if (labelIds === null) return badRequest(c, 'invalid label filter')

    const search = c.req.query('q')?.trim().slice(0, 100)
    const page = await app.$issue.list(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      {
        ...parsePageQuery(c.req.query()),
        state,
        ...(type ? { type } : {}),
        ...(labelIds.length > 0 ? { labelIds } : {}),
        ...(search ? { search } : {}),
      },
    )
    return sendOk(c, page)
  })

  app.get('/:number/history', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const number = positiveId(c.req.param('number'))
    if (number === null) return notFound(c, 'issue not found')
    const history = await app.$issue.history(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      number,
    )
    return history ? sendOk(c, history) : notFound(c, 'issue not found')
  })

  app.get('/:number/revisions/:revisionNumber', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const number = positiveId(c.req.param('number'))
    const revisionNumber = positiveId(c.req.param('revisionNumber'))
    if (number === null || revisionNumber === null) return notFound(c, 'revision not found')
    const revision = await app.$issue.revision(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      number,
      revisionNumber,
    )
    return revision ? sendOk(c, revision) : notFound(c, 'revision not found')
  })

  app.get('/:number', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')
    const number = positiveId(c.req.param('number'))
    if (number === null) return notFound(c, 'issue not found')
    const issue = await app.$issue.get(
      { workspaceId: currentApp.workspaceId, appId: currentApp.id },
      number,
    )
    return issue ? sendOk(c, issue) : notFound(c, 'issue not found')
  })
}
