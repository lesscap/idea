import type { App, AppStatus, Id, Paged, PageQuery } from '@idea/shared'
import { paged, toOffset } from '@idea/shared'
import type { Service } from '../types.ts'

export type AppCreate = {
  readonly workspaceId: Id
  readonly name: string
  readonly description: string | null
  readonly createdById: Id
}

export type AppPatch = {
  readonly name?: string
  readonly description?: string | null
  readonly status?: AppStatus
}

export type AppService = {
  listInWorkspace: (workspaceId: Id, query: PageQuery) => Promise<Paged<App>>
  // Takes the workspace as well as the id: scoping belongs in the query, not in
  // a caller-side check after the fact.
  getInWorkspace: (workspaceId: Id, id: Id) => Promise<App | null>
  create: (input: AppCreate) => Promise<App | 'name_taken'>
  update: (workspaceId: Id, id: Id, patch: AppPatch) => Promise<App | null | 'name_taken'>
}

type Row = {
  id: number
  workspaceId: number
  name: string
  description: string | null
  status: AppStatus
  createdById: number
  createdAt: Date
  updatedAt: Date
}

const toApp = (row: Row): App => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

// Prisma throws P2002 when a unique constraint is violated. Here that is always
// the (workspaceId, name) pair.
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'

export const createAppService: Service<AppService> = app => ({
  // Every read is filtered by workspaceId in the WHERE clause. Fetching and
  // then filtering in memory would work until the day someone forgets the
  // second step, and that day it silently returns another tenant's data.
  listInWorkspace: async (workspaceId, query) => {
    const { offset, limit } = toOffset(query)
    const [rows, total] = await Promise.all([
      app.prisma.app.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      app.prisma.app.count({ where: { workspaceId } }),
    ])
    return paged(rows.map(toApp), total, query)
  },

  getInWorkspace: async (workspaceId, id) => {
    const row = await app.prisma.app.findFirst({ where: { id, workspaceId } })
    return row ? toApp(row) : null
  },

  create: async input => {
    try {
      return toApp(await app.prisma.app.create({ data: input }))
    } catch (err) {
      if (isUniqueViolation(err)) return 'name_taken'
      throw err
    }
  },

  update: async (workspaceId, id, patch) => {
    // updateMany rather than update, so the workspace filter is part of the
    // statement: update() keys on id alone and would happily edit another
    // tenant's row.
    try {
      const { count } = await app.prisma.app.updateMany({ where: { id, workspaceId }, data: patch })
      if (count === 0) return null
      const row = await app.prisma.app.findFirst({ where: { id, workspaceId } })
      return row ? toApp(row) : null
    } catch (err) {
      if (isUniqueViolation(err)) return 'name_taken'
      throw err
    }
  },
})
