import { randomToken, sha256 } from '@idea/core'
import type { AgentEffort, Id } from '@idea/shared'
import type { Service } from '../types.ts'
import type { ProviderConfig } from './provider.ts'

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
  readonly machineId: string
  readonly name: string
  readonly hostname: string
}

export type WorkerOption = Worker & {
  readonly online: boolean
  readonly providerLabel: string
  readonly providerKind: string
  readonly defaultModel: string
  readonly models: readonly string[]
  readonly efforts: Readonly<Record<string, readonly AgentEffort[]>>
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
  // A machine is one worker deployment. Changing its backend in place would
  // invalidate every conversation currently assigned to it.
  | { kind: 'provider_mismatch'; existing: Worker }

export type WorkerService = {
  register: (input: RegisterInput) => Promise<RegisterResult>
  byToken: (token: string) => Promise<Worker | null>
  getForWorkspace: (workspaceId: Id, workerId: Id) => Promise<WorkerOption | null>
  listOnline: (workspaceId: Id, providerId?: Id) => Promise<readonly WorkerOption[]>
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
  machineId: row.machineId,
  name: row.name,
  hostname: row.hostname,
})

const option = (
  row: Parameters<typeof view>[0] & {
    provider: { kind: string; label: string; config: unknown }
  },
  online: boolean,
): WorkerOption => {
  const config = row.provider.config as ProviderConfig
  return {
    ...view(row),
    online,
    providerLabel: row.provider.label,
    providerKind: row.provider.kind,
    defaultModel: config.model,
    models: config.models ?? [],
    efforts: config.efforts ?? {},
  }
}

const OPTION_SELECT = {
  ...SELECT,
  provider: { select: { kind: true, label: true, config: true } },
} as const

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
      const fields = { name: input.name, hostname: input.hostname }

      const byMachine = await tx.worker.findUnique({
        where: { workspaceId_machineId: { workspaceId, machineId: input.machineId } },
        select: SELECT,
      })

      if (byMachine) {
        if (byMachine.providerId !== provider.id)
          return { kind: 'provider_mismatch' as const, existing: view(byMachine) }

        await tx.workerEnrolment.update({
          where: { id: enrolment.id },
          data: { lastUsedAt: new Date() },
        })
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

      await tx.workerEnrolment.update({
        where: { id: enrolment.id },
        data: { lastUsedAt: new Date() },
      })
      const created = await tx.worker.create({
        data: {
          workspaceId,
          machineId: input.machineId,
          providerId: provider.id,
          ...fields,
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

  getForWorkspace: async (workspaceId, workerId) => {
    const row = await app.$prisma.worker.findFirst({
      where: { id: workerId, workspaceId, provider: { enabled: true } },
      select: OPTION_SELECT,
    })
    return row ? option(row, app.$commands.connected(row.id)) : null
  },

  listOnline: async (workspaceId, providerId) => {
    const rows = await app.$prisma.worker.findMany({
      where: {
        workspaceId,
        provider: { enabled: true },
        ...(providerId === undefined ? {} : { providerId }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: OPTION_SELECT,
    })
    return rows.filter(row => app.$commands.connected(row.id)).map(row => option(row, true))
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
