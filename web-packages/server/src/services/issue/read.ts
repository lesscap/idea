import type { Prisma } from '@idea/core'
import type {
  Attachment,
  IssueActivity,
  IssueContent,
  IssueDetail,
  IssueHistoryEntry,
  IssueLabel,
  IssueRevision,
  IssueRevisionSummary,
  IssueSummary,
} from '@idea/shared'
import { paged, toOffset } from '../../paging.ts'
import type { Service } from '../../types.ts'
import { fileSelect, toAttachment } from './files.ts'
import type { IssueListQuery, IssueReads } from './types.ts'

const actorSelect = { id: true, name: true } as const
const labelSelect = { id: true, name: true, description: true, color: true } as const
const filesSelect = {
  select: { role: true, position: true, file: { select: fileSelect } },
  orderBy: { position: 'asc' as const },
} as const
const summarySelect = {
  id: true,
  number: true,
  title: true,
  state: true,
  closeReason: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: actorSelect },
  labels: {
    select: { label: { select: labelSelect } },
    orderBy: { label: { name: 'asc' as const } },
  },
} as const satisfies Prisma.IssueSelect
const detailSelect = {
  ...summarySelect,
  body: true,
  revisionSequence: true,
  closedAt: true,
  updatedBy: { select: actorSelect },
  closedBy: { select: actorSelect },
  files: filesSelect,
} as const satisfies Prisma.IssueSelect
const revisionSelect = {
  id: true,
  number: true,
  title: true,
  body: true,
  createdAt: true,
  editedBy: { select: actorSelect },
  files: filesSelect,
} as const satisfies Prisma.IssueRevisionSelect
const activitySelect = {
  id: true,
  kind: true,
  fromState: true,
  toState: true,
  closeReason: true,
  fromType: true,
  toType: true,
  labelId: true,
  labelName: true,
  labelColor: true,
  createdAt: true,
  actor: { select: actorSelect },
} as const satisfies Prisma.IssueActivitySelect

type SummaryRow = Prisma.IssueGetPayload<{ select: typeof summarySelect }>
type DetailRow = Prisma.IssueGetPayload<{ select: typeof detailSelect }>
type RevisionRow = Prisma.IssueRevisionGetPayload<{ select: typeof revisionSelect }>
type ActivityRow = Prisma.IssueActivityGetPayload<{ select: typeof activitySelect }>
type ContentRow = Pick<IssueContent, 'title' | 'body'> & {
  readonly files: readonly { readonly role: 'image' | 'attachment'; readonly file: Attachment }[]
}

const toLabel = (label: IssueLabel): IssueLabel => ({ ...label })
const toLabels = (row: SummaryRow): readonly IssueLabel[] =>
  row.labels.map(item => toLabel(item.label))
const filesByRole = (row: ContentRow, role: 'image' | 'attachment'): readonly Attachment[] =>
  row.files.filter(item => item.role === role).map(item => toAttachment(item.file))
const toContent = (row: ContentRow): IssueContent => ({
  title: row.title,
  body: row.body,
  images: filesByRole(row, 'image'),
  attachments: filesByRole(row, 'attachment'),
})

const toSummary = (row: SummaryRow): IssueSummary => ({
  id: row.id,
  number: row.number,
  title: row.title,
  state: row.state,
  closeReason: row.closeReason,
  type: row.type,
  labels: toLabels(row),
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const toDetail = (row: DetailRow): IssueDetail => ({
  ...toContent(row),
  ...toSummary(row),
  revisionNumber: row.revisionSequence,
  updatedBy: row.updatedBy,
  closedBy: row.closedBy,
  closedAt: row.closedAt?.toISOString() ?? null,
})

const toRevisionSummary = (row: RevisionRow): IssueRevisionSummary => ({
  kind: 'revision',
  id: row.id,
  number: row.number,
  editedBy: row.editedBy,
  createdAt: row.createdAt.toISOString(),
})
const toRevision = (row: RevisionRow): IssueRevision => ({
  ...toContent(row),
  ...toRevisionSummary(row),
})

const toActivity = (row: ActivityRow): IssueActivity => {
  const base = { id: row.id, actor: row.actor, createdAt: row.createdAt.toISOString() }
  if (row.kind === 'state_changed' && row.fromState && row.toState) {
    return {
      ...base,
      kind: row.kind,
      fromState: row.fromState,
      toState: row.toState,
      closeReason: row.closeReason,
    }
  }
  if (row.kind === 'type_changed') {
    return { ...base, kind: row.kind, fromType: row.fromType, toType: row.toType }
  }
  if (
    (row.kind === 'label_added' || row.kind === 'label_removed') &&
    row.labelName &&
    row.labelColor
  ) {
    return {
      ...base,
      kind: row.kind,
      labelId: row.labelId,
      labelName: row.labelName,
      labelColor: row.labelColor,
    }
  }
  throw new Error(`invalid issue activity ${row.id}`)
}

const issueNumber = (search: string): number | null => {
  const match = search.match(/^#?(\d+)$/)
  return match ? Number(match[1]) : null
}

const listWhere = (
  workspaceId: number,
  appId: number,
  query: IssueListQuery,
): Prisma.IssueWhereInput => {
  const number = query.search ? issueNumber(query.search) : null
  const labelFilters = (query.labelIds ?? []).map(labelId => ({ labels: { some: { labelId } } }))
  return {
    appId,
    app: { workspaceId },
    state: query.state,
    ...(query.type ? { type: query.type } : {}),
    AND: [
      ...labelFilters,
      ...(query.search
        ? [
            {
              OR: [
                ...(number === null ? [] : [{ number }]),
                { title: { contains: query.search, mode: 'insensitive' as const } },
                { body: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
    ],
  }
}

export const createIssueReads: Service<IssueReads> = app => ({
  list: async ({ workspaceId, appId }, query) => {
    const where = listWhere(workspaceId, appId, query)
    const { offset, limit } = toOffset(query)
    const [rows, total] = await Promise.all([
      app.$prisma.issue.findMany({
        where,
        select: summarySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      app.$prisma.issue.count({ where }),
    ])
    return paged(rows.map(toSummary), total, query)
  },
  get: async ({ workspaceId, appId }, number) => {
    const row = await app.$prisma.issue.findFirst({
      where: { appId, number, app: { workspaceId } },
      select: detailSelect,
    })
    return row ? toDetail(row) : null
  },
  revision: async ({ workspaceId, appId }, number, revisionNumber) => {
    const row = await app.$prisma.issueRevision.findFirst({
      where: { number: revisionNumber, issue: { number, appId, app: { workspaceId } } },
      select: revisionSelect,
    })
    return row ? toRevision(row) : null
  },
  history: async ({ workspaceId, appId }, number) => {
    const issue = await app.$prisma.issue.findFirst({
      where: { number, appId, app: { workspaceId } },
      select: {
        revisions: { select: revisionSelect },
        activities: { select: activitySelect },
      },
    })
    if (!issue) return null
    return [...issue.revisions.map(toRevisionSummary), ...issue.activities.map(toActivity)].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    ) satisfies IssueHistoryEntry[]
  },
  labels: async ({ workspaceId, appId }) =>
    (
      await app.$prisma.label.findMany({
        where: { appId, app: { workspaceId } },
        select: labelSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })
    ).map(toLabel),
})
