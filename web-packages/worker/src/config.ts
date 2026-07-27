import { hostname } from 'node:os'

export type WorkerConfig = {
  readonly server: string
  readonly name: string
  readonly hostname: string
  readonly capabilities: readonly string[]
  // How many turns may run at once. Concurrency is a slot count rather than a
  // process count — one daemon serves every application, so scaling by process
  // would multiply machines by applications.
  readonly slots: number
}

type Env = Record<string, string | undefined>

// One daemon per machine, not per project: a worker registers what it can *do*,
// and the server routes work to it by capability. Nothing here binds to a
// project — that identifier travels on each command instead.
const parseCapabilities = (raw: string | undefined): readonly string[] =>
  (raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

// Bounded rather than trusted: a mistyped value should not become unlimited
// concurrency, and zero would leave a worker that connects but never works.
const parseSlots = (raw: string | undefined): number => {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 16) : 4
}

// Pure: `env` and `host` are parameters so tests pass literals.
export const loadWorkerConfig = (
  env: Env = process.env,
  host: string = hostname(),
): WorkerConfig => ({
  server: env.IDEA_SERVER ?? 'http://localhost:3300',
  // The display handle. Defaults to the machine name so a worker started with no
  // configuration is still identifiable in a fleet.
  name: env.WORKER_NAME || host,
  hostname: host,
  capabilities: parseCapabilities(env.WORKER_CAPABILITIES),
  slots: parseSlots(env.WORKER_SLOTS),
})
