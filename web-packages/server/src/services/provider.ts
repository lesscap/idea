import type { Id } from '@idea/shared'
import type { Service } from '../types.ts'

// Which agent backends exist, and how to reach them.
//
// Two axes, deliberately separate: `name` is which provider (glm, deepseek,
// codex) and `kind` is which SDK speaks to it (claude, codex). GLM and DeepSeek
// are both `claude` and differ only by endpoint — which is exactly why one
// adapter serves both, and why collapsing these into one field would force a
// second adapter for no reason.
//
// NOTHING SECRET LIVES HERE. `tokenEnv` names the environment variable holding
// a provider's credential; the value is only ever in the worker's environment.
// The database says where to look and never what it is, so a database dump
// yields no usable key and configuring a provider in the interface never
// involves handling one.

export type ProviderConfig = {
  readonly baseUrl: string
  readonly model: string
  readonly tokenEnv: string
}

export type Provider = {
  readonly id: Id
  readonly name: string
  readonly label: string
  readonly kind: string
  readonly enabled: boolean
  readonly config: ProviderConfig
}

export type ProviderService = {
  listEnabled: () => Promise<Provider[]>
  get: (id: Id) => Promise<Provider | null>
  byName: (name: string) => Promise<Provider | null>
}

const SELECT = {
  id: true,
  name: true,
  label: true,
  kind: true,
  enabled: true,
  config: true,
} as const

const view = (row: {
  id: number
  name: string
  label: string
  kind: string
  enabled: boolean
  config: unknown
}): Provider => ({
  id: row.id,
  name: row.name,
  label: row.label,
  kind: row.kind,
  enabled: row.enabled,
  config: row.config as ProviderConfig,
})

export const createProviderService: Service<ProviderService> = app => {
  const listEnabled = async () =>
    (
      await app.$prisma.provider.findMany({
        where: { enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: SELECT,
      })
    ).map(view)

  return {
    listEnabled,

    get: async id => {
      const row = await app.$prisma.provider.findUnique({ where: { id }, select: SELECT })
      return row ? view(row) : null
    },

    // Workers identify their backend by name — the value an operator puts in a
    // container's configuration. Resolving it to a row is how registration finds
    // out whether that backend exists at all.
    byName: async name => {
      const row = await app.$prisma.provider.findUnique({ where: { name }, select: SELECT })
      return row ? view(row) : null
    },
  }
}
