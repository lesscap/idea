import type { WorkerConfig } from './config.ts'

// The long-lived worker process. One per machine — not one per project.
//
// A worker registers a set of *capabilities* and the server routes work to it by
// matching against them; the project an item belongs to rides on each command
// instead of being baked into the worker's identity. So a machine runs a single
// daemon holding a single connection, however many projects it serves.
//
// (baton, the reference for this design, binds a worker to one project because
// its agent works inside a git worktree and project↔repo is 1:1. Our agent
// elicits requirements rather than editing code, so that constraint is absent
// and the per-project process it forced is not worth inheriting.)
//
// Not built yet, in the order it should be built:
//   1. register on start — POST /workers { machineId, name, hostname,
//      capabilities }, persisting the returned identity and token locally
//   2. hold one outbound command stream (GET /workers/me/stream) and demultiplex
//      commands by the projectId / conversationId each carries. Outbound-only is
//      deliberate: no inbound port, so this runs behind NAT on any machine
//   3. per command, run a Claude Agent SDK conversation, bounded by a slot
//      count. Concurrency comes from slots, not from one process per task
//   4. self-watchdog: if the server goes unreachable, exit non-zero and let the
//      process supervisor restart a clean worker
//
// Known trade-off of the single-daemon model: one process holds several
// projects' context at once, so a crash or a leak crosses project boundaries in
// a way per-project processes would not. Acceptable for an internal platform;
// if real tenant isolation is ever needed, run several workers on the machine
// with disjoint capability sets — the model already allows it.
//
// For now it starts, announces itself, and stays up until signalled — enough to
// prove the process shape and the shutdown path.
export const runDaemon = async (config: WorkerConfig): Promise<void> => {
  console.log(`idea worker "${config.name}" on ${config.hostname} → ${config.server}`)
  console.log(
    config.capabilities.length > 0
      ? `capabilities: ${config.capabilities.join(', ')}`
      : 'no capabilities declared — this worker would receive no work',
  )

  await new Promise<void>(resolve => {
    // Signal listeners do not hold Node's event loop open, and there is no
    // connection holding it either yet — without a live handle the process
    // would exit the moment it started. Step 2 above replaces this timer with
    // the command stream, which keeps the loop alive on its own.
    const keepalive = setInterval(() => {}, 60_000)

    const stop = () => {
      clearInterval(keepalive)
      console.log('worker stopping')
      resolve()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}
