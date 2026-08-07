import type { ConversationExecution, Id } from '@idea/shared'
import type { Service } from '../types.ts'

// One unit of agent work, and the rules for who may run it.
//
// A conversation names its current worker. The `runningKey` unique index still
// serialises turns within that conversation when a worker has several slots.
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

// Everything the claim needs to know about who is asking. Passed rather than
// looked up so the caller cannot accidentally claim on behalf of a worker it did
// not authenticate.
export type Claimant = {
  readonly id: Id
  readonly workspaceId: Id
  readonly providerId: Id
}

export type TurnService = {
  // Null when there is nothing to do, or nothing this worker may take right now.
  claimNext: (worker: Claimant) => Promise<ClaimedTurn | null>
  execution: (conversationId: Id) => Promise<ConversationExecution>
  renewLease: (turnId: Id, workerId: Id) => Promise<boolean>
  finish: (turnId: Id, workerId: Id, outcome: TurnOutcome) => Promise<boolean>
  requestAbort: (turnId: Id) => Promise<boolean>
  isAbortRequested: (turnId: Id) => Promise<boolean>
  // Returns how many turns were returned to the queue and how many gave up.
  reap: () => Promise<{ requeued: number; failed: number }>
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

  const tryClaim = async (
    candidate: ClaimedTurn,
    worker: Claimant,
  ): Promise<ClaimedTurn | null> => {
    try {
      const claimed = await app.$prisma.turn.updateMany({
        // `status: 'queued'` in the filter is the second half of the guard: it
        // makes the claim conditional on the row still being unclaimed, so a
        // worker that read it a moment ago cannot overwrite a fresher claim.
        where: {
          id: candidate.id,
          status: 'queued',
          conversation: {
            workerId: worker.id,
            providerId: worker.providerId,
            app: { workspaceId: worker.workspaceId },
          },
        },
        data: {
          status: 'running',
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
    claimNext: async worker => {
      // Workspace and provider remain explicit security/integrity checks even
      // though the worker id already names one row. Assignment alone must never
      // become a shortcut around tenant confinement.
      const candidates = await app.$prisma.turn.findMany({
        where: {
          status: 'queued',
          conversation: {
            workerId: worker.id,
            providerId: worker.providerId,
            app: { workspaceId: worker.workspaceId },
          },
        },
        orderBy: { id: 'asc' },
        take: CANDIDATES,
        select: { id: true, conversationId: true, userEventSequence: true, attempt: true },
      })

      // Sequential and short-circuiting on purpose: each attempt is a write, and
      // the first success is the answer.
      for (const candidate of candidates) {
        const claimed = await tryClaim(candidate, worker)
        if (!claimed) continue
        return claimed
      }
      return null
    },

    execution: async conversationId => {
      const open = await app.$prisma.turn.findMany({
        where: { conversationId, status: { in: ['queued', 'running'] } },
        select: { status: true },
      })
      if (open.some(turn => turn.status === 'running')) return { state: 'running' }
      return open.some(turn => turn.status === 'queued') ? { state: 'queued' } : { state: 'idle' }
    },

    // The relation guard is load-bearing. After a lease is requeued or a
    // conversation moves, a stale worker must not renew the old execution.
    renewLease: async (turnId, workerId) => {
      const renewed = await app.$prisma.turn.updateMany({
        where: { id: turnId, status: 'running', conversation: { workerId } },
        data: { leaseUntil: leaseUntil() },
      })
      return renewed.count === 1
    },

    finish: async (turnId, workerId, outcome) => {
      const finished = await app.$prisma.turn.updateMany({
        where: { id: turnId, status: 'running', conversation: { workerId } },
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
              data: { status: 'queued', leaseUntil: null, runningKey: null },
            }),
      ])

      return { requeued: requeued.count, failed: failed.count }
    },
  }
}
