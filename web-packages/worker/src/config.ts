import { hostname } from 'node:os'

export type WorkerConfig = {
  readonly server: string
  // Proves which workspace this worker may serve. It cannot name the workspace
  // itself: a container started by anyone would otherwise be able to declare
  // itself part of any tenant and start claiming their conversations.
  readonly enrolmentToken: string
  // Which agent backend this container runs, by registry name. One, not a list —
  // wanting two means running two containers, which is also how they end up
  // isolated from each other.
  readonly provider: string
  readonly name: string
  readonly hostname: string
  // How many turns may run at once. Concurrency is a slot count rather than a
  // process count: nothing is kept alive between turns, so idle conversations
  // cost nothing and only work in flight occupies anything.
  readonly slots: number
}

type Env = Record<string, string | undefined>

// Bounded rather than trusted: a mistyped value should not become unlimited
// concurrency, and zero would leave a worker that connects but never works.
const parseSlots = (raw: string | undefined): number => {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 16) : 4
}

export class ConfigError extends Error {}

// Pure: `env` and `host` are parameters so tests pass literals.
//
// Throws rather than defaulting for the two that cannot be guessed. A worker
// with no enrolment token has no workspace to serve, and one with no provider
// has no backend to run — both would otherwise register successfully and then
// fail on the first turn, which is a worse place to find out.
export const loadWorkerConfig = (
  env: Env = process.env,
  host: string = hostname(),
): WorkerConfig => {
  const enrolmentToken = env.IDEA_ENROLMENT_TOKEN?.trim()
  if (!enrolmentToken) throw new ConfigError('IDEA_ENROLMENT_TOKEN is required')

  const provider = env.IDEA_PROVIDER?.trim()
  if (!provider) throw new ConfigError('IDEA_PROVIDER is required (a provider name, e.g. glm)')

  return {
    server: env.IDEA_SERVER ?? 'http://localhost:3300',
    enrolmentToken,
    provider,
    // The display handle. Defaults to the machine name so a worker started with
    // minimal configuration is still identifiable in a fleet.
    name: env.WORKER_NAME || host,
    hostname: host,
    slots: parseSlots(env.WORKER_SLOTS),
  }
}
