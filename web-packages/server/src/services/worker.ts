import { randomToken, sha256 } from '@idea/core'
import type { Id } from '@idea/shared'
import type { Service } from '../types.ts'

// Agent daemons, each serving exactly one workspace.
//
// That binding is a security boundary before it is a routing rule. The agent
// executes instructions that arrive from outside — a message someone typed, and
// later the contents of a repository it reads — so the process running it is
// confined to one tenant's data, and the claim query refuses to hand it anything
// else even if that confinement is defeated.
//
// A worker cannot name its own workspace: it presents an enrolment token, and
// the token decides. Otherwise a container started by anyone could declare
// itself part of any workspace it liked.
//
// Liveness is not stored. A worker is usable exactly while its command stream is
// connected, so there is no timestamp to sweep and no timeout to tune.

export type Worker = {
  readonly id: Id
  readonly workspaceId: Id
  readonly providerId: Id
  // A copy of the provider's kind, so the claim can stamp a conversation without
  // a second lookup on every attempt.
  readonly agentKind: string
  readonly machineId: string
  readonly name: string
  readonly hostname: string
}

export type RegisterInput = {
  enrolmentToken: string
  machineId: string
  name: string
  hostname: string
  // Which backend this container runs, by registry name. Not a list: one
  // container serves one provider, and wanting two means running two.
  provider: string
}

export type RegisterResult =
  | { kind: 'created' | 'reattached'; worker: Worker; apiToken: string }
  // Another machine in this workspace already answers to this name. Reported
  // rather than resolved: renaming one silently leaves an operator unable to
  // tell which machine they are looking at.
  | { kind: 'name_collision'; existing: Worker }
  // Unknown token. Deliberately says nothing about which workspace, or whether
  // any workspace exists — a rejected token should teach the holder nothing.
  | { kind: 'not_enrolled' }
  // The container names a backend the platform does not know, or that is turned
  // off. Refused at registration rather than at the first turn.
  | { kind: 'unknown_provider' }

export type WorkerService = {
  register: (input: RegisterInput) => Promise<RegisterResult>
  byToken: (token: string) => Promise<Worker | null>
  createEnrolment: (
    workspaceId: Id,
    createdById: Id,
    label: string,
  ) => Promise<{ token: string; label: string }>
}

const SELECT = {
  id: true,
  workspaceId: true,
  providerId: true,
  machineId: true,
  name: true,
  hostname: true,
  provider: { select: { kind: true } },
} as const

const view = (row: {
  id: number
  workspaceId: number
  providerId: number
  machineId: string
  name: string
  hostname: string
  provider: { kind: string }
}): Worker => ({
  id: row.id,
  workspaceId: row.workspaceId,
  providerId: row.providerId,
  agentKind: row.provider.kind,
  machineId: row.machineId,
  name: row.name,
  hostname: row.hostname,
})

export const createWorkerService: Service<WorkerService> = app => ({
  // Idempotent on IDENTITY, anchored on (workspace, machine): a restarted daemon
  // recovers its row rather than accumulating duplicates.
  //
  // The token is NOT idempotent — every registration issues a fresh one. Only
  // the hash is stored, so an old token could not be handed back even in
  // principle, and rotating is the honest resolution: a daemon registers
  // precisely because it needs a usable credential.
  register: input =>
    app.$prisma.$transaction(async tx => {
      const enrolment = await tx.workerEnrolment.findUnique({
        where: { tokenHash: sha256(input.enrolmentToken) },
        select: { id: true, workspaceId: true },
      })
      if (!enrolment) return { kind: 'not_enrolled' as const }

      const provider = await tx.provider.findUnique({
        where: { name: input.provider },
        select: { id: true, enabled: true },
      })
      if (!provider?.enabled) return { kind: 'unknown_provider' as const }

      const { workspaceId } = enrolment
      const apiToken = randomToken()
      // Hashed at rest, like invite tokens: a database dump then yields nothing
      // that can be presented as a worker.
      const secret = { apiToken: sha256(apiToken) }
      const fields = { name: input.name, hostname: input.hostname, providerId: provider.id }

      await tx.workerEnrolment.update({
        where: { id: enrolment.id },
        data: { lastUsedAt: new Date() },
      })

      const byMachine = await tx.worker.findUnique({
        where: { workspaceId_machineId: { workspaceId, machineId: input.machineId } },
        select: { id: true },
      })

      if (byMachine) {
        const row = await tx.worker.update({
          where: { id: byMachine.id },
          data: { ...fields, ...secret },
          select: SELECT,
        })
        return { kind: 'reattached' as const, worker: view(row), apiToken }
      }

      const byName = await tx.worker.findUnique({
        where: { workspaceId_name: { workspaceId, name: input.name } },
        select: SELECT,
      })
      if (byName) return { kind: 'name_collision' as const, existing: view(byName) }

      const created = await tx.worker.create({
        data: { workspaceId, machineId: input.machineId, ...fields, ...secret },
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

  // The plaintext is returned once and never stored — same shape as an invite.
  // Revoking is deleting the row.
  createEnrolment: async (workspaceId, createdById, label) => {
    const token = randomToken()
    await app.$prisma.workerEnrolment.create({
      data: { workspaceId, createdById, label, tokenHash: sha256(token) },
    })
    return { token, label }
  },
})
