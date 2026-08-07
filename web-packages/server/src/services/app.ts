import type { AppStatus, Id, Paged, PageQuery } from '@idea/shared'
import { paged, toOffset } from '../paging.ts'
import type { Service } from '../types.ts'

export type AppRecord = {
  readonly id: Id
  readonly workspaceId: Id
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly status: AppStatus
  readonly createdById: Id
  readonly createdAt: string
  readonly updatedAt: string
}

export type AppCreate = {
  readonly workspaceId: Id
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly createdById: Id
}

export type AppPatch = {
  readonly slug?: string
  readonly name?: string
  readonly description?: string | null
  readonly status?: AppStatus
}

export type AppWriteResult =
  | { readonly kind: 'ok'; readonly app: AppRecord }
  | { readonly kind: 'name_taken' }
  | { readonly kind: 'slug_taken' }

export type AppUpdateResult = AppWriteResult | { readonly kind: 'not_found' }

export type AppDeleteResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'busy' }

export type AppService = {
  listInWorkspace: (workspaceId: Id, query: PageQuery) => Promise<Paged<AppRecord>>
  getByIdInWorkspace: (workspaceId: Id, appId: Id) => Promise<AppRecord | null>
  getBySlugInWorkspace: (workspaceId: Id, slug: string) => Promise<AppRecord | null>
  create: (input: AppCreate) => Promise<AppWriteResult>
  update: (workspaceId: Id, appId: Id, patch: AppPatch) => Promise<AppUpdateResult>
  remove: (workspaceId: Id, appId: Id) => Promise<AppDeleteResult>
}

type Row = {
  id: number
  workspaceId: number
  slug: string
  name: string
  description: string | null
  status: AppStatus
  createdById: number
  createdAt: Date
  updatedAt: Date
}

const toApp = (row: Row): AppRecord => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const hasPrismaCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code

type ConflictCandidate = {
  readonly slug?: string
  readonly name?: string
}

type AppConflict = { readonly kind: 'name_taken' } | { readonly kind: 'slug_taken' }

export const createAppService: Service<AppService> = app => {
  const findConflict = async (
    workspaceId: Id,
    candidate: ConflictCandidate,
    excludeId?: Id,
  ): Promise<AppConflict | null> => {
    const id = excludeId === undefined ? undefined : { not: excludeId }

    if (
      candidate.slug !== undefined &&
      (await app.$prisma.app.findFirst({
        where: { workspaceId, slug: candidate.slug, id },
        select: { id: true },
      }))
    )
      return { kind: 'slug_taken' }

    if (
      candidate.name !== undefined &&
      (await app.$prisma.app.findFirst({
        where: { workspaceId, name: candidate.name, id },
        select: { id: true },
      }))
    )
      return { kind: 'name_taken' }

    return null
  }

  return {
    // Every read is filtered by workspaceId in the WHERE clause. Fetching and
    // then filtering in memory would work until the day someone forgets the
    // second step, and that day it silently returns another tenant's data.
    listInWorkspace: async (workspaceId, query) => {
      const { offset, limit } = toOffset(query)
      const [rows, total] = await Promise.all([
        app.$prisma.app.findMany({
          where: { workspaceId },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        app.$prisma.app.count({ where: { workspaceId } }),
      ])
      return paged(rows.map(toApp), total, query)
    },

    getBySlugInWorkspace: async (workspaceId, slug) => {
      const row = await app.$prisma.app.findFirst({ where: { workspaceId, slug } })
      return row ? toApp(row) : null
    },

    getByIdInWorkspace: async (workspaceId, appId) => {
      const row = await app.$prisma.app.findFirst({ where: { workspaceId, id: appId } })
      return row ? toApp(row) : null
    },

    create: async input => {
      try {
        return { kind: 'ok', app: toApp(await app.$prisma.app.create({ data: input })) }
      } catch (error) {
        if (!hasPrismaCode(error, 'P2002')) throw error
        const conflict = await findConflict(input.workspaceId, input)
        if (conflict) return conflict
        throw error
      }
    },

    update: async (workspaceId, appId, patch) => {
      try {
        const row = await app.$prisma.app.update({
          where: { id: appId, workspaceId },
          data: patch,
        })
        return { kind: 'ok', app: toApp(row) }
      } catch (error) {
        if (hasPrismaCode(error, 'P2025')) return { kind: 'not_found' }
        if (!hasPrismaCode(error, 'P2002')) throw error

        const current = await app.$prisma.app.findFirst({
          where: { id: appId, workspaceId },
          select: { id: true },
        })
        if (!current) return { kind: 'not_found' }

        const conflict = await findConflict(workspaceId, patch, current.id)
        if (conflict) return conflict
        throw error
      }
    },

    remove: (workspaceId, appId) =>
      app.$prisma.$transaction(async tx => {
        const found = await tx.app.findFirst({
          where: { id: appId, workspaceId },
          select: { id: true },
        })
        if (!found) return { kind: 'not_found' }

        const activeTurns = await tx.turn.count({
          where: {
            status: { in: ['queued', 'running'] },
            conversation: { appId: found.id },
          },
        })
        if (activeTurns > 0) return { kind: 'busy' }

        const deleted = await tx.app.deleteMany({ where: { id: found.id, workspaceId } })
        return deleted.count === 0 ? { kind: 'not_found' } : { kind: 'ok' }
      }),
  }
}
