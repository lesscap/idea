import { createClient } from './client.ts'
import type { WorkerConfig } from './config.ts'
import { readOrCreateMachineId, workspaceRoot } from './identity.ts'
import { runTurn } from './turn.ts'

// The long-lived worker process. One workspace, one agent backend.
//
// The workspace binding is a security boundary before it is a routing rule: this
// process runs instructions that arrive from outside — a message someone typed,
// and later the contents of a repository it reads — so it is confined to one
// tenant's data, and the server's claim query refuses to hand it anything else
// even if that confinement is defeated. It cannot name its own workspace either;
// an enrolment token decides.
//
// Nothing is kept alive between turns. Everything a conversation needs in order
// to resume lives outside this process: the transcript on the server, the branch
// in the repository, the agent's own session beside the worktree. So idle
// conversations cost nothing, and only work in flight occupies anything.
//
// Concurrency is a slot count, not a process count: slots bound how many turns
// run at once, and each occupied slot releases when its turn ends.

// Reconnection backoff for the command stream. A dropped stream is routine — a
// deploy, a proxy timeout — and since the queue is durable there is nothing to
// recover, only somewhere to be.
const RECONNECT_MS = 3_000

// A backstop for claiming rather than the main path: commands arrive over the
// stream, and this catches work that appeared while the stream was down.
const POLL_MS = 15_000

// Losing the server means every lease this process holds is expiring unrenewed.
// Exiting lets the supervisor start a clean one instead of lingering while
// holding turns nobody is running.
const WATCHDOG_MS = 30_000
const WATCHDOG_FAILURES = 3

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })

export const runDaemon = async (config: WorkerConfig): Promise<void> => {
  const log = (message: string) => console.log(`[idea-worker] ${message}`)
  const root = workspaceRoot()
  const machineId = readOrCreateMachineId()
  const client = createClient(config.server)

  const registered = await client.register({
    enrolmentToken: config.enrolmentToken,
    provider: config.provider,
    machineId,
    name: config.name,
    hostname: config.hostname,
  })
  log(
    `${registered.outcome} as worker ${registered.id} (${config.name}) running ${config.provider} → ${config.server}`,
  )
  log(`workspace root: ${root}`)

  const abort = new AbortController()
  let running = 0
  let draining = false
  let exitCode = 0

  const stop = (code: number) => {
    exitCode = code
    abort.abort()
  }

  // Claims until there is nothing more it may take. `draining` collapses
  // overlapping wake-ups: several commands arriving together should not each
  // start their own loop.
  const drain = async (): Promise<void> => {
    if (draining || abort.signal.aborted) return
    draining = true
    try {
      while (running < config.slots && !abort.signal.aborted) {
        const claimed = await client.claim().catch(error => {
          log(`claim failed: ${String(error)}`)
          return null
        })
        // A claim without either is a server the worker cannot work with; stop
        // rather than spin.
        if (!claimed?.conversation || !claimed.provider) break

        running++
        const { turn, conversation, provider } = claimed
        // Deliberately not awaited: the loop goes back for more work while this
        // turn runs, which is what the slots are for.
        void runTurn(client, root, turn, conversation, provider, log).finally(() => {
          running--
          // Finishing frees both a slot and the conversation, so something that
          // was unclaimable a moment ago may be claimable now.
          void drain()
        })
      }
    } finally {
      draining = false
    }
  }

  // Reconnects for as long as the process lives, and drains after each
  // connection ends — anything that arrived while it was down is waiting in the
  // queue rather than lost.
  const listen = async (): Promise<void> => {
    while (!abort.signal.aborted) {
      try {
        await client.stream(command => {
          if (command.type === 'work_available') void drain()
        }, abort.signal)
      } catch (error) {
        if (abort.signal.aborted) return
        log(`stream lost: ${String(error)}`)
      }
      if (abort.signal.aborted) return
      await sleep(RECONNECT_MS, abort.signal)
      void drain()
    }
  }

  const poll = setInterval(() => void drain(), POLL_MS)

  let failures = 0
  const watchdog = setInterval(() => {
    void client
      .ping()
      .then(() => {
        failures = 0
      })
      .catch(() => {
        failures++
        if (failures < WATCHDOG_FAILURES) return
        log(`server unreachable after ${failures} attempts — exiting for restart`)
        stop(1)
      })
  }, WATCHDOG_MS)

  process.once('SIGINT', () => stop(0))
  process.once('SIGTERM', () => stop(0))

  void drain()
  await listen()

  clearInterval(poll)
  clearInterval(watchdog)
  log('stopping')
  if (exitCode !== 0) process.exitCode = exitCode
}
