import type {
  Id,
  IssueCloseReason,
  IssueDetail,
  IssueHistoryEntry,
  IssueLabel,
  IssueRevision,
  IssueState,
  IssueSummary,
  IssueType,
  Paged,
} from '@idea/shared'
import { del, get, patch, post, put } from '../../lib/request'

const issuesPath = (appId: Id): string => `/apps/${encodeURIComponent(appId)}/issues`
const labelsPath = (appId: Id): string => `/apps/${encodeURIComponent(appId)}/labels`

export const issueResourceRef = (number: number): string => `issues/${number}`
export const newIssueResourceRef = 'issues/new'
export const labelsResourceRef = 'issues/labels'

export type IssueListFilters = {
  readonly page: number
  readonly state: IssueState
  readonly search: string
  readonly type: IssueType | null
  readonly labelIds: readonly Id[]
}

export type IssueContentInput = {
  readonly title: string
  readonly body: string
  readonly imageFids: readonly string[]
  readonly attachmentFids: readonly string[]
}

export const listIssues = (appId: Id, filters: IssueListFilters): Promise<Paged<IssueSummary>> => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: '20',
    state: filters.state,
  })
  if (filters.search) params.set('q', filters.search)
  if (filters.type) params.set('type', filters.type)
  if (filters.labelIds.length > 0) params.set('labels', filters.labelIds.join(','))
  return get<Paged<IssueSummary>>(`${issuesPath(appId)}?${params}`)
}

export const getIssue = (appId: Id, number: number): Promise<IssueDetail> =>
  get<IssueDetail>(`${issuesPath(appId)}/${number}`)

export const createIssue = (
  appId: Id,
  input: IssueContentInput & { readonly type: IssueType | null; readonly labelIds: readonly Id[] },
): Promise<IssueDetail> => post<IssueDetail>(issuesPath(appId), input)

export const updateIssue = (
  appId: Id,
  number: number,
  input: IssueContentInput & {
    readonly type: IssueType | null
    readonly labelIds: readonly Id[]
    readonly expectedUpdatedAt: string
  },
): Promise<IssueDetail> => patch<IssueDetail>(`${issuesPath(appId)}/${number}`, input)

export const setIssueType = (
  appId: Id,
  number: number,
  type: IssueType | null,
): Promise<IssueDetail> => patch<IssueDetail>(`${issuesPath(appId)}/${number}/type`, { type })

export const setIssueLabels = (
  appId: Id,
  number: number,
  labelIds: readonly Id[],
): Promise<IssueDetail> => put<IssueDetail>(`${issuesPath(appId)}/${number}/labels`, { labelIds })

export const closeIssue = (
  appId: Id,
  number: number,
  reason: IssueCloseReason,
): Promise<IssueDetail> => post<IssueDetail>(`${issuesPath(appId)}/${number}/close`, { reason })

export const reopenIssue = (appId: Id, number: number): Promise<IssueDetail> =>
  post<IssueDetail>(`${issuesPath(appId)}/${number}/reopen`)

export const getIssueHistory = (appId: Id, number: number): Promise<readonly IssueHistoryEntry[]> =>
  get<readonly IssueHistoryEntry[]>(`${issuesPath(appId)}/${number}/history`)

export const getIssueRevision = (
  appId: Id,
  number: number,
  revisionNumber: number,
): Promise<IssueRevision> =>
  get<IssueRevision>(`${issuesPath(appId)}/${number}/revisions/${revisionNumber}`)

export const listLabels = (appId: Id): Promise<readonly IssueLabel[]> =>
  get<readonly IssueLabel[]>(labelsPath(appId))

export type LabelInput = {
  readonly name: string
  readonly description: string | null
  readonly color: string
}

export const createLabel = (appId: Id, input: LabelInput): Promise<IssueLabel> =>
  post<IssueLabel>(labelsPath(appId), input)

export const updateLabel = (appId: Id, labelId: Id, input: LabelInput): Promise<IssueLabel> =>
  patch<IssueLabel>(`${labelsPath(appId)}/${labelId}`, input)

export const deleteLabel = (appId: Id, labelId: Id): Promise<{ readonly removed: boolean }> =>
  del(`${labelsPath(appId)}/${labelId}`)
