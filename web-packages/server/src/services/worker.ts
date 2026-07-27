import { randomToken, sha256 } from '@idea/core'
import type { Id } from '@idea/shared'
import type { Service } from '../types.ts'

// Agent daemons. One per machine, serving every application — which work
// reaches a worker is decided by its capabilities, not by its identity. A daemon
// per app per machine would put the process count on a product of two numbers
// that both grow.
//
// Liveness is not stored. A worker is usable exactly while its command stream is
// connected (see the command bus), so there is no timestamp to sweep and no
// timeout to tune.

export type Worker = {
  readonly id: Id
  readonly machineId: string
  readonly name: string
  readonly hostname: string
  readonly capabilities: readonly string[]
}

export type RegisterInput = {
  machineId: string
  name: string
  hostname: string
  capabilities: readonly string[]
}

export type RegisterResult =
  | { kind: 'created' | 'reattached'; worker: Worker; apiToken: string }
  // Another machine is already using this display name. Reported rather than
  // resolved: silently renaming one of them leaves an operator unable to tell
  // which machine they are looking at.
  | { kind: 'name_collision'; existing: Worker }

export type WorkerService = {
  register: (input: RegisterInput) => Promise<RegisterResult>
  byToken: (token: string) => Promise<Worker | null>
}

const view = (row: {
  id: number
  machineId: string
  name: string
  hostname: string
  capabilities: string[]
}): Worker => ({
  id: row.id,
  machineId: row.machineId,
  name: row.name,
  hostname: row.hostname,
  capabilities: row.capabilities,
})

const SELECT = {
  id: true,
  machineId: true,
  name: true,
  hostname: true,
  capabilities: true,
} as const

export const createWorkerService: Service<WorkerService> = app => ({
  // Idempotent on IDENTITY, anchored on machineId: a restarted daemon recovers
  // its worker row instead of accumulating duplicates.
  //
  // The token is NOT idempotent — every successful registration issues a fresh
  // one. Only the hash is stored, so a re-registering daemon could not be handed
  // its old token back even in principle, and rotating is the honest resolution:
  // a daemon registers precisely because it needs a usable token, and the
  // previous one dying with the previous process is the desired outcome.
  register: input =>
    app.$prisma.$transaction(async tx => {
      const byMachine = await tx.worker.findUnique({
        where: { machineId: input.machineId },
        select: SELECT,
      })
      const apiToken = randomToken()
      // Hashed at rest, like invite tokens: a database dump then yields nothing
      // that can be presented as a worker.
      const secret = { apiToken: sha256(apiToken) }

      if (byMachine) {
        const row = await tx.worker.update({
          where: { id: byMachine.id },
          data: {
            name: input.name,
            hostname: input.hostname,
            capabilities: [...input.capabilities],
            ...secret,
          },
          select: SELECT,
        })
        return { kind: 'reattached' as const, worker: view(row), apiToken }
      }

      const byName = await tx.worker.findUnique({ where: { name: input.name }, select: SELECT })
      if (byName) return { kind: 'name_collision' as const, existing: view(byName) }

      const created = await tx.worker.create({
        data: {
          machineId: input.machineId,
          name: input.name,
          hostname: input.hostname,
          capabilities: [...input.capabilities],
          ...secret,
        },
        select: SELECT,
      })
      return { kind: 'created' as const, worker: view(created), apiToken }
    }),

  byToken: async token => {
    const row = await app.$prisma.worker.findUnique({
      where: { apiToken: sha256(token) },
      select: SELECT,
    })
    return row ? view(row) : null
  },
})
