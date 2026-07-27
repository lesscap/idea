import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Who this machine is, and what it currently holds.
//
// The two are stored apart on purpose. The machine id is identity and must
// survive anything: lose it and the server sees a brand-new worker, so the old
// row lingers with turns nobody will run. The token is a credential that is
// reissued on every registration, so losing it costs one round trip.

const dataHome = (env: NodeJS.ProcessEnv): string =>
  env.XDG_DATA_HOME ?? join(env.HOME ?? homedir(), '.local', 'share')

export const machineIdPath = (env: NodeJS.ProcessEnv = process.env): string =>
  join(dataHome(env), 'idea', 'machine-id')

// Ours rather than /etc/machine-id or the platform UUID: no root needed, the
// same on every OS, and a cloned VM gets its own on first run instead of
// impersonating the machine it was cloned from.
export const readOrCreateMachineId = (path: string = machineIdPath()): string => {
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing) return existing
  }
  const id = randomUUID()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${id}\n`, 'utf8')
  return id
}

// Where repos and worktrees live. Under the data home for the same reason: they
// are recoverable state, not configuration.
export const workspaceRoot = (env: NodeJS.ProcessEnv = process.env): string =>
  env.IDEA_WORKER_HOME ?? join(dataHome(env), 'idea')
