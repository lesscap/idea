import type { Id, WorkerCommand } from '@idea/shared'

export type { WorkerCommand } from '@idea/shared'

// Server→worker push, keyed by worker.
//
// Live-only, with no replay and no delivery tracking, and that is the design
// rather than a shortcut: a command is a nudge saying "there may be work", while
// the authoritative queue is the `turns` table. A command that never arrives
// costs a delay until the worker asks again — it cannot lose the work, because
// the work was never in here.
//
// Which is also why presence on this bus is the only definition of "connected".
// Nothing writes a last-seen timestamp anywhere, so nothing has to sweep for
// stale ones or agree on a timeout.

type Send = (command: WorkerCommand) => void

export type CommandBus = {
  // Returns the unsubscribe. A worker with several connections — a restart
  // overlapping its predecessor — receives on all of them; the turn claim
  // decides who actually does the work.
  subscribe: (workerId: Id, send: Send) => () => void
  publish: (workerId: Id, command: WorkerCommand) => void
  broadcast: (command: WorkerCommand) => void
  connected: (workerId: Id) => boolean
}

export const createCommandBus = (): CommandBus => {
  const subscribers = new Map<Id, Set<Send>>()

  return {
    subscribe: (workerId, send) => {
      const existing = subscribers.get(workerId) ?? new Set<Send>()
      existing.add(send)
      subscribers.set(workerId, existing)

      return () => {
        existing.delete(send)
        if (existing.size === 0) subscribers.delete(workerId)
      }
    },

    publish: (workerId, command) => {
      for (const send of subscribers.get(workerId) ?? []) send(command)
    },

    // Used when work appears: any worker may be the one that can take it, and
    // the claim sorts out who does.
    broadcast: command => {
      for (const sends of subscribers.values()) for (const send of sends) send(command)
    },

    connected: workerId => (subscribers.get(workerId)?.size ?? 0) > 0,
  }
}
