import type { Prisma } from '@idea/core'
import type {
  RequirementContent,
  RequirementDetail,
  RequirementDraft,
  RequirementRevision,
  RequirementRevisionSummary,
  RequirementSummary,
} from '@idea/shared'
import {
  parseRequirementCode,
  requirementCode,
  revisionCode,
  visibleRequirementContent,
} from '../../domains/requirement.ts'
import { paged, toOffset } from '../../paging.ts'
import type { Service } from '../../types.ts'
import type { RequirementListQuery, RequirementReads } from './types.ts'

const contentSelect = { title: true, summary: true, body: true } as const
const listContentSelect = { title: true, summary: true } as const
const conversationSelect = { select: { cid: true } } as const
const draftSelect = {
  ...contentSelect,
  version: true,
  updatedAt: true,
  updatedInConversation: conversationSelect,
} as const
const revisionSelect = {
  id: true,
  number: true,
  ...contentSelect,
  confirmedAt: true,
  confirmedInConversation: conversationSelect,
} as const
const revisionSummarySelect = {
  id: true,
  number: true,
  confirmedAt: true,
} as const
const summarySelect = {
  id: true,
  number: true,
  status: true,
  updatedAt: true,
  draft: { select: listContentSelect },
  currentRevision: { select: { ...listContentSelect, number: true } },
} as const satisfies Prisma.RequirementSelect
const detailSelect = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  draft: { select: draftSelect },
  currentRevision: { select: revisionSelect },
  revisions: { select: revisionSummarySelect, orderBy: { number: 'desc' as const } },
} as const satisfies Prisma.RequirementSelect

type SummaryRow = Prisma.RequirementGetPayload<{ select: typeof summarySelect }>
type DetailRow = Prisma.RequirementGetPayload<{ select: typeof detailSelect }>
type RevisionRow = Prisma.RequirementRevisionGetPayload<{ select: typeof revisionSelect }>
type RevisionSummaryRow = Prisma.RequirementRevisionGetPayload<{
  select: typeof revisionSummarySelect
}>

const toContent = (row: RequirementContent): RequirementContent => ({
  title: row.title,
  summary: row.summary,
  body: row.body,
})

const toDraft = (row: NonNullable<DetailRow['draft']>): RequirementDraft => ({
  ...toContent(row),
  version: row.version,
  updatedAt: row.updatedAt.toISOString(),
  updatedInConversationCid: row.updatedInConversation?.cid ?? null,
})

const toRevisionSummary = (row: RevisionSummaryRow): RequirementRevisionSummary => ({
  id: row.id,
  version: row.number,
  code: revisionCode(row.number),
  confirmedAt: row.confirmedAt.toISOString(),
})

const toRevision = (row: RevisionRow): RequirementRevision => ({
  ...toContent(row),
  ...toRevisionSummary(row),
  confirmedInConversationCid: row.confirmedInConversation?.cid ?? null,
})

const toSummary = (row: SummaryRow): RequirementSummary => {
  const content = visibleRequirementContent(row.currentRevision, row.draft)
  return {
    id: row.id,
    number: row.number,
    code: requirementCode(row.number),
    status: row.status,
    title: content?.title ?? '',
    summary: content?.summary ?? '',
    currentRevisionCode:
      row.currentRevision === null ? null : revisionCode(row.currentRevision.number),
    hasDraft: row.draft !== null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

const toDetail = (row: DetailRow): RequirementDetail => ({
  id: row.id,
  number: row.number,
  code: requirementCode(row.number),
  status: row.status,
  draft: row.draft ? toDraft(row.draft) : null,
  currentRevision: row.currentRevision ? toRevision(row.currentRevision) : null,
  revisions: row.revisions.map(toRevisionSummary),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const contentContains = (search: string) => ({
  OR: [
    { title: { contains: search, mode: 'insensitive' as const } },
    { summary: { contains: search, mode: 'insensitive' as const } },
  ],
})

const listWhere = (
  workspaceId: number,
  appId: number,
  query: RequirementListQuery,
): Prisma.RequirementWhereInput => {
  const search = query.search
  if (!search) return { appId, app: { workspaceId } }

  const number = parseRequirementCode(search.toUpperCase())
  return {
    appId,
    app: { workspaceId },
    OR: [
      ...(number === null ? [] : [{ number }]),
      { currentRevision: { is: contentContains(search) } },
      {
        AND: [{ currentRevision: { is: null } }, { draft: { is: contentContains(search) } }],
      },
    ],
  }
}

export const createRequirementReads: Service<RequirementReads> = app => ({
  list: async ({ workspaceId, appId }, query) => {
    const where = listWhere(workspaceId, appId, query)
    const { offset, limit } = toOffset(query)
    const [rows, total] = await Promise.all([
      app.$prisma.requirement.findMany({
        where,
        select: summarySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      app.$prisma.requirement.count({ where }),
    ])
    return paged(rows.map(toSummary), total, query)
  },

  get: async ({ workspaceId, appId }, requirementId) => {
    const row = await app.$prisma.requirement.findFirst({
      where: { id: requirementId, appId, app: { workspaceId } },
      select: detailSelect,
    })
    return row ? toDetail(row) : null
  },

  byCode: async ({ workspaceId, appId }, code) => {
    const number = parseRequirementCode(code)
    if (number === null) return null
    const row = await app.$prisma.requirement.findFirst({
      where: { appId, number, app: { workspaceId } },
      select: { id: true, number: true },
    })
    return row ? { id: row.id, code: requirementCode(row.number) } : null
  },

  revision: async ({ workspaceId, appId }, requirementId, revisionId) => {
    const row = await app.$prisma.requirementRevision.findFirst({
      where: {
        id: revisionId,
        requirementId,
        requirement: { appId, app: { workspaceId } },
      },
      select: revisionSelect,
    })
    return row ? toRevision(row) : null
  },
})
