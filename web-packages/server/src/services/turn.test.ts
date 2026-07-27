import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConversationService } from './conversation.ts'
import { createPendingInputService } from './pending-input.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'
import { createTurnService } from './turn.ts'

// Everything here is about two things happening at once, which is exactly what a
// mocked client cannot reproduce: the serialisation lives in a unique index, not
// in this code. See test-db.ts for how the schema is isolated.

describe.skipIf(!databaseUrl)('turn lifecycle', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      $conversation: createConversationService(app),
      $pendingInput: createPendingInputService(app),
      $turn: createTurnService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  const conversation = () =>
    db.app.$conversation.create({
      workspaceId: db.workspaceId,
      appId: null,
      createdById: db.userId,
    })

  const worker = async (name: string) =>
    (
      await db.prisma.worker.create({
        data: { machineId: name, name, hostname: 'h', apiToken: name },
        select: { id: true },
      })
    ).id

  describe('claiming', () => {
    // The core of the design. Two workers reach for the same conversation; the
    // unique index on runningKey rejects the second, and that rejection IS the
    // cross-process serialisation.
    it('lets exactly one worker run a conversation at a time', async () => {
      const c = await conversation()
      const [w1, w2] = [await worker('claim-a'), await worker('claim-b')]
      // Two separate turns on one conversation — the situation the index exists
      // for. Claiming the same row twice would be caught by status alone.
      await db.prisma.turn.createMany({
        data: [
          { conversationId: c.id, userEventSequence: 0 },
          { conversationId: c.id, userEventSequence: 1 },
        ],
      })

      const claims = await Promise.all([db.app.$turn.claimNext(w1), db.app.$turn.claimNext(w2)])

      expect(claims.filter(Boolean)).toHaveLength(1)
      expect(
        await db.prisma.turn.count({ where: { conversationId: c.id, status: 'running' } }),
      ).toBe(1)
    })

    it('frees the conversation once the turn finishes', async () => {
      const c = await conversation()
      const w = await worker('claim-serial')
      await db.prisma.turn.createMany({
        data: [
          { conversationId: c.id, userEventSequence: 0 },
          { conversationId: c.id, userEventSequence: 1 },
        ],
      })

      const first = await db.app.$turn.claimNext(w)
      expect(first).not.toBeNull()
      expect(await db.app.$turn.claimNext(w)).toBeNull() // still busy

      await db.app.$turn.finish(first!.id, 'completed')

      expect(await db.app.$turn.claimNext(w)).not.toBeNull()
    })

    it('moves on to another conversation rather than giving up', async () => {
      const [busy, free] = [await conversation(), await conversation()]
      const w = await worker('claim-skip')
      await db.prisma.turn.createMany({
        data: [
          { conversationId: busy.id, userEventSequence: 0 },
          { conversationId: busy.id, userEventSequence: 1 },
          { conversationId: free.id, userEventSequence: 0 },
        ],
      })

      await db.app.$turn.claimNext(w) // takes busy's first
      const next = await db.app.$turn.claimNext(w)

      expect(next?.conversationId).toBe(free.id)
    })
  })

  describe('leases', () => {
    const expire = (turnId: number) =>
      db.prisma.turn.update({ where: { id: turnId }, data: { leaseUntil: new Date(0) } })

    it('returns an expired turn to the queue', async () => {
      const c = await conversation()
      const w = await worker('lease-expire')
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(w)
      await expire(claimed!.id)

      expect((await db.app.$turn.reap()).requeued).toBeGreaterThanOrEqual(1)

      const row = await db.prisma.turn.findUniqueOrThrow({ where: { id: claimed!.id } })
      expect(row.status).toBe('queued')
      // Released, or the conversation would stay locked by a turn nobody runs.
      expect(row.runningKey).toBeNull()
    })

    // Without renewal, a single tool call that runs longer than the lease gets
    // its turn taken away and executed a second time.
    it('does not reclaim a turn that keeps renewing', async () => {
      const c = await conversation()
      const w = await worker('lease-renew')
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(w)

      await expire(claimed!.id)
      expect(await db.app.$turn.renewLease(claimed!.id, w)).toBe(true)
      await db.app.$turn.reap()

      expect((await db.prisma.turn.findUniqueOrThrow({ where: { id: claimed!.id } })).status).toBe(
        'running',
      )
    })

    // The guard that stops a slow-but-alive worker from extending a lease it no
    // longer holds after the reaper handed its turn to someone else.
    it('refuses renewal from a worker that no longer holds the turn', async () => {
      const c = await conversation()
      const [owner, other] = [await worker('lease-owner'), await worker('lease-other')]
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(owner)

      expect(await db.app.$turn.renewLease(claimed!.id, other)).toBe(false)
    })

    it('gives up on a turn that keeps failing instead of retrying forever', async () => {
      const c = await conversation()
      const w = await worker('lease-attempts')
      const turn = await db.prisma.turn.create({
        data: { conversationId: c.id, userEventSequence: 0, attempt: 3 },
      })
      await db.prisma.turn.update({
        where: { id: turn.id },
        data: { status: 'running', workerId: w, runningKey: String(c.id), leaseUntil: new Date(0) },
      })

      expect((await db.app.$turn.reap()).failed).toBeGreaterThanOrEqual(1)
      expect((await db.prisma.turn.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe(
        'failed',
      )
    })

    // A dropped command stream means the worker's child processes are already
    // gone; waiting out the leases would only make someone wait longer.
    it('releases every turn a disconnected worker held', async () => {
      const c = await conversation()
      const w = await worker('lease-release')
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      await db.app.$turn.claimNext(w)

      expect(await db.app.$turn.releaseWorker(w)).toBe(1)
      expect(await db.app.$turn.claimNext(await worker('lease-successor'))).not.toBeNull()
    })
  })

  describe('materialize', () => {
    it('merges everything pending into one message and one turn', async () => {
      const c = await conversation()
      for (const text of ['要报销审批', '要能传发票', '超 5000 要总监批'])
        await db.app.$pendingInput.enqueue(c.id, { text })

      const stored = await db.app.$pendingInput.materialize(c.id)

      expect(stored?.event).toMatchObject({
        type: 'user_message',
        text: '要报销审批\n\n要能传发票\n\n超 5000 要总监批',
      })
      expect(await db.prisma.turn.count({ where: { conversationId: c.id } })).toBe(1)
      expect(await db.app.$pendingInput.list(c.id)).toEqual([])
    })

    it('leaves the queue alone while a turn is already open', async () => {
      const c = await conversation()
      await db.app.$pendingInput.enqueue(c.id, { text: 'first' })
      await db.app.$pendingInput.materialize(c.id)
      await db.app.$pendingInput.enqueue(c.id, { text: 'second' })

      expect(await db.app.$pendingInput.materialize(c.id)).toBeNull()
      // Still pending, not lost — it goes out when the open turn finishes.
      expect(await db.app.$pendingInput.list(c.id)).toHaveLength(1)
    })

    it('withdraws an unsent line without disturbing the rest', async () => {
      const c = await conversation()
      const regret = await db.app.$pendingInput.enqueue(c.id, { text: 'ignore me' })
      await db.app.$pendingInput.enqueue(c.id, { text: 'keep me' })

      expect(await db.app.$pendingInput.cancel(c.id, regret.id)).toBe(true)
      const stored = await db.app.$pendingInput.materialize(c.id)

      expect(stored?.event).toMatchObject({ text: 'keep me' })
    })

    // Two callers materializing at once must not produce two turns, and must not
    // consume each other's rows.
    it('produces one turn when two callers materialize together', async () => {
      const c = await conversation()
      await db.app.$pendingInput.enqueue(c.id, { text: 'a' })
      await db.app.$pendingInput.enqueue(c.id, { text: 'b' })

      const results = await Promise.all([
        db.app.$pendingInput.materialize(c.id),
        db.app.$pendingInput.materialize(c.id),
      ])

      expect(results.filter(Boolean)).toHaveLength(1)
      expect(await db.prisma.turn.count({ where: { conversationId: c.id } })).toBe(1)
      expect(await db.app.$pendingInput.list(c.id)).toEqual([])
    })
  })

  describe('the transcript', () => {
    it('numbers events from zero without gaps under concurrent appends', async () => {
      const c = await conversation()

      await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          db.app.$conversation.appendEvent(c.id, { type: 'user_message', text: `m${i}` }),
        ),
      )

      const events = await db.app.$conversation.events(c.id)
      expect(events.map(e => e.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    })

    it('returns only what a reconnecting client missed', async () => {
      const c = await conversation()
      for (const text of ['a', 'b', 'c'])
        await db.app.$conversation.appendEvent(c.id, { type: 'user_message', text })

      const missed = await db.app.$conversation.events(c.id, 0)

      expect(missed.map(e => e.sequence)).toEqual([1, 2])
    })
  })
})
