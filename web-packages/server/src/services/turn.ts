import type { Id } from '@idea/shared'
import type { Service } from '../types.ts'

// One unit of agent work, and the rules for who may run it.
//
// Work is routed to whichever worker is free, so two of them can reach for the
// same conversation at the same moment. The `runningKey` unique index settles
// that: a claim writes the conversation id there, and a second claim for a
// conversation that already has one running collides and backs off. The database
// is the lock, which is why there is no lock service here.
//
// A claim is a LEASE, not a handover. A worker that dies mid-turn cannot hand
// anything back, so the lease expires and the reaper returns the turn. Renewal
// comes from turn heartbeats — see renewLease for what breaks without them.

export type ClaimedTurn = {
  readonly id: Id
  readonly conversationId: Id
  readonly userEventSequence: number
  readonly attempt: number
}

export type TurnOutcome = 'completed' | 'failed' | 'aborted'

export type TurnService = {
  // Null when there is nothing to do, or nothing this worker may take right now.
  claimNext: (workerId: Id) => Promise<ClaimedTurn | null>
  renewLease: (turnId: Id, workerId: Id) => Promise<boolean>
  finish: (turnId: Id, outcome: TurnOutcome) => Promise<boolean>
  requestAbort: (turnId: Id) => Promise<boolean>
  isAbortRequested: (turnId: Id) => Promise<boolean>
  // Returns how many turns were returned to the queue and how many gave up.
  reap: () => Promise<{ requeued: number; failed: number }>
  // Every turn a worker was running, released at once. Called when its command
  // stream drops: the child processes died with it, so waiting out the leases
  // would only add delay.
  releaseWorker: (workerId: Id) => Promise<number>
}

// How long a claim is good for without renewal. Long enough that a slow
// heartbeat does not lose a turn, short enough that a dead worker's work is
// picked up while the person is still waiting.
const LEASE_MS = 60_000

// How many queued turns to consider before giving up this round. Bounded
// because most collisions mean "this conversation is busy", and the next worker
// to ask will find the same wall.
const CANDIDATES = 20

// Past this, a turn has failed the same way repeatedly and retrying is just a
// slower way to fail.
const MAX_ATTEMPTS = 3

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

export const createTurnService: Service<TurnService> = app => {
  const leaseUntil = () => new Date(Date.now() + LEASE_MS)

  const tryClaim = async (candidate: ClaimedTurn, workerId: Id): Promise<ClaimedTurn | null> => {
    try {
      const claimed = await app.$prisma.turn.updateMany({
        // `status: 'queued'` in the filter is the second half of the guard: it
        // makes the claim conditional on the row still being unclaimed, so a
        // worker that read it a moment ago cannot overwrite a fresher claim.
        where: { id: candidate.id, status: 'queued' },
        data: {
          status: 'running',
          workerId,
          runningKey: String(candidate.conversationId),
          leaseUntil: leaseUntil(),
          startedAt: new Date(),
          attempt: { increment: 1 },
        },
      })
      // Zero rows: another worker claimed this exact turn first.
      if (claimed.count === 0) return null
    } catch (error) {
      // The conversation already has a turn running. Not an error — it is the
      // serialisation working.
      if (isUniqueViolation(error)) return null
      throw error
    }
    return { ...candidate, attempt: candidate.attempt + 1 }
  }

  return {
    claimNext: async workerId => {
      const candidates = await app.$prisma.turn.findMany({
        where: { status: 'queued' },
        orderBy: { id: 'asc' },
        take: CANDIDATES,
        select: { id: true, conversationId: true, userEventSequence: true, attempt: true },
      })

      // Sequential and short-circuiting on purpose: each attempt is a write, and
      // the first success is the answer.
      for (const candidate of candidates) {
        const claimed = await tryClaim(candidate, workerId)
        if (claimed) return claimed
      }
      return null
    },

    // Guarded by workerId, and that guard is load-bearing. Once a lease expires
    // and the reaper hands the turn to someone else, the original worker may
    // still be alive and still heartbeating; without this it would extend a
    // lease it no longer holds and two workers would run the same turn.
    renewLease: async (turnId, workerId) => {
      const renewed = await app.$prisma.turn.updateMany({
        where: { id: turnId, workerId, status: 'running' },
        data: { leaseUntil: leaseUntil() },
      })
      return renewed.count === 1
    },

    finish: async (turnId, outcome) => {
      const finished = await app.$prisma.turn.updateMany({
        where: { id: turnId, status: 'running' },
        // Clearing runningKey releases the conversation. Doing it in the same
        // write as the status means there is no window where the turn is over
        // but the conversation still looks busy.
        data: { status: outcome, finishedAt: new Date(), leaseUntil: null, runningKey: null },
      })
      return finished.count === 1
    },

    // A request, not an action: only the worker running the turn can actually
    // stop it. It sees this on its next check and ends the turn itself, which
    // keeps the transcript's closing event honest about what happened.
    requestAbort: async turnId => {
      const marked = await app.$prisma.turn.updateMany({
        where: { id: turnId, status: { in: ['queued', 'running'] } },
        data: { abortRequestedAt: new Date() },
      })
      return marked.count === 1
    },

    isAbortRequested: async turnId => {
      const row = await app.$prisma.turn.findUnique({
        where: { id: turnId },
        select: { abortRequestedAt: true },
      })
      return row?.abortRequestedAt !== null && row?.abortRequestedAt !== undefined
    },

    reap: async () => {
      const expired = await app.$prisma.turn.findMany({
        where: { status: 'running', leaseUntil: { lt: new Date() } },
        select: { id: true, attempt: true },
      })

      const [giveUp, retry] = [
        expired.filter(t => t.attempt >= MAX_ATTEMPTS),
        expired.filter(t => t.attempt < MAX_ATTEMPTS),
      ]

      const [failed, requeued] = await Promise.all([
        giveUp.length === 0
          ? { count: 0 }
          : app.$prisma.turn.updateMany({
              where: { id: { in: giveUp.map(t => t.id) }, status: 'running' },
              data: {
                status: 'failed',
                finishedAt: new Date(),
                leaseUntil: null,
                runningKey: null,
              },
            }),
        retry.length === 0
          ? { count: 0 }
          : app.$prisma.turn.updateMany({
              where: { id: { in: retry.map(t => t.id) }, status: 'running' },
              // Back to queued with runningKey cleared, so the conversation is
              // free for whoever picks it up next.
              data: { status: 'queued', workerId: null, leaseUntil: null, runningKey: null },
            }),
      ])

      return { requeued: requeued.count, failed: failed.count }
    },

    releaseWorker: async workerId => {
      const released = await app.$prisma.turn.updateMany({
        where: { workerId, status: 'running' },
        data: { status: 'queued', workerId: null, leaseUntil: null, runningKey: null },
      })
      return released.count
    },
  }
}
