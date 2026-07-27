import type { PrismaClient } from '@idea/core'
import type { Service } from '../types.ts'

export type HealthReport = {
  readonly ok: boolean
  readonly db: 'up' | 'down'
}

export type HealthService = {
  check: () => Promise<HealthReport>
}

// Reachability probe, not a query: works against a schema with zero models, so
// it stays valid as the schema grows.
const pingDb = async (prisma: PrismaClient): Promise<'up' | 'down'> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'up'
  } catch {
    return 'down'
  }
}

// `ok` reports the process, `db` reports its dependency — a server that is up
// with a dead database is a distinct state from one that is down, and load
// balancers need to tell them apart.
export const createHealthService: Service<HealthService> = app => ({
  check: async () => ({ ok: true, db: await pingDb(app.$prisma) }),
})
