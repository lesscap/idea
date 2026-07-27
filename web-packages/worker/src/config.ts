import { hostname } from 'node:os'

export type WorkerConfig = {
  readonly server: string
  readonly name: string
  readonly hostname: string
  readonly capabilities: readonly string[]
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
})
