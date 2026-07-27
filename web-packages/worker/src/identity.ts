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

// Where repos, worktrees and sessions live. In a container this is the
// workspace's mounted volume — one volume, one workspace, one worker identity.
export const workspaceRoot = (env: NodeJS.ProcessEnv = process.env): string =>
  env.IDEA_WORKER_HOME ?? join(dataHome(env), 'idea')

// Beside the data it identifies. In a container that is the workspace's volume,
// so a rebuilt container recovers its worker row instead of leaving a dead one
// behind and registering a new one; on bare metal it is just the data home.
export const machineIdPath = (env: NodeJS.ProcessEnv = process.env): string =>
  join(workspaceRoot(env), 'machine-id')

// Ours rather than /etc/machine-id or the platform UUID: no root needed, the
// same on every OS, and a cloned VM gets its own on first run instead of
// impersonating the machine it was cloned from.
//
// An explicit value wins, for deployments that would rather name their workers
// than let them name themselves.
export const readOrCreateMachineId = (
  path: string = machineIdPath(),
  override = process.env.WORKER_MACHINE_ID,
): string => {
  if (override?.trim()) return override.trim()
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing) return existing
  }
  const id = randomUUID()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${id}\n`, 'utf8')
  return id
}
