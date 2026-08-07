import { nanoid } from 'nanoid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCommandBus } from '../command-bus.ts'
import { createEventBus } from '../event-bus.ts'
import { createConversationService } from './conversation/index.ts'
import { createPendingInputService } from './pending-input.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'
import { type Claimant, createTurnService } from './turn.ts'

// Everything here is about two things happening at once, which is exactly what a
// mocked client cannot reproduce: the serialisation lives in a unique index, not
// in this code. See test-db.ts for how the schema is isolated.

describe.skipIf(!databaseUrl)('turn lifecycle', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      // Real rather than stubbed: it holds only live subscriptions, so there is
      // nothing to fake and a stub would just be another thing to keep correct.
      $events: createEventBus(),
      $commands: createCommandBus(),
      $conversation: createConversationService(app),
      $pendingInput: createPendingInputService(app),
      $turn: createTurnService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  const provider = async (name: string) =>
    db.prisma.provider.upsert({
      where: { name },
      update: {},
      create: { name, label: name, kind: 'claude', config: {} },
      select: { id: true },
    })

  const worker = async (
    name: string,
    options: { workspaceId?: number; provider?: string } = {},
  ): Promise<Claimant> => {
    const backend = await provider(options.provider ?? 'claude-test')
    return db.prisma.worker.create({
      data: {
        workspaceId: options.workspaceId ?? db.workspaceId,
        providerId: backend.id,
        machineId: name,
        name,
        hostname: 'h',
        apiToken: name,
      },
      select: { id: true, workspaceId: true, providerId: true },
    })
  }

  const conversation = async (
    assigned?: Claimant,
    workspaceId = assigned?.workspaceId ?? db.workspaceId,
  ) => {
    const owner = assigned ?? (await worker(`conversation-${nanoid(6)}`, { workspaceId }))
    const app = await db.prisma.app.upsert({
      where: { workspaceId_slug: { workspaceId, slug: 'turn-tests' } },
      update: {},
      create: {
        workspaceId,
        slug: 'turn-tests',
        name: 'Turn tests',
        createdById: db.userId,
      },
      select: { id: true },
    })
    const row = await db.prisma.conversation.create({
      data: {
        cid: nanoid(12),
        appId: app.id,
        createdById: db.userId,
        providerId: owner.providerId,
        workerId: owner.id,
      },
      select: { id: true },
    })
    return { ...row, worker: owner }
  }

  describe('claiming', () => {
    // The core of the design. Two workers reach for the same conversation; the
    // unique index on runningKey rejects the second, and that rejection IS the
    // cross-process serialisation.
    it('lets exactly one worker run a conversation at a time', async () => {
      const c = await conversation()
      const other = await worker('claim-b')
      // Two separate turns on one conversation — the situation the index exists
      // for. Claiming the same row twice would be caught by status alone.
      await db.prisma.turn.createMany({
        data: [
          { conversationId: c.id, userEventSequence: 0 },
          { conversationId: c.id, userEventSequence: 1 },
        ],
      })

      const claims = await Promise.all([
        db.app.$turn.claimNext(c.worker),
        db.app.$turn.claimNext(other),
      ])

      expect(claims.filter(Boolean)).toHaveLength(1)
      expect(
        await db.prisma.turn.count({ where: { conversationId: c.id, status: 'running' } }),
      ).toBe(1)
    })

    it('frees the conversation once the turn finishes', async () => {
      const c = await conversation()
      await db.prisma.turn.createMany({
        data: [
          { conversationId: c.id, userEventSequence: 0 },
          { conversationId: c.id, userEventSequence: 1 },
        ],
      })

      const first = await db.app.$turn.claimNext(c.worker)
      expect(first).not.toBeNull()
      expect(await db.app.$turn.claimNext(c.worker)).toBeNull() // still busy

      await db.app.$turn.finish(first!.id, c.worker.id, 'completed')

      expect(await db.app.$turn.claimNext(c.worker)).not.toBeNull()
    })

    it('moves on to another conversation rather than giving up', async () => {
      const w = await worker('claim-skip')
      const [busy, free] = [await conversation(w), await conversation(w)]
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

  describe('execution state', () => {
    it('reports a queue without consulting worker liveness', async () => {
      const c = await conversation()
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })

      expect(await db.app.$turn.execution(c.id)).toEqual({ state: 'queued' })
    })

    it('reports running and idle without consulting worker presence', async () => {
      const c = await conversation()
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })

      expect(await db.app.$turn.execution(c.id)).toMatchObject({ state: 'queued' })
      const claimed = await db.app.$turn.claimNext(c.worker)
      expect(await db.app.$turn.execution(c.id)).toEqual({ state: 'running' })
      const waiting = await db.prisma.turn.create({
        data: { conversationId: c.id, userEventSequence: 1 },
      })
      expect(await db.app.$turn.execution(c.id)).toEqual({ state: 'running' })
      await db.prisma.turn.delete({ where: { id: waiting.id } })
      await db.app.$turn.finish(claimed!.id, c.worker.id, 'completed')
      expect(await db.app.$turn.execution(c.id)).toEqual({ state: 'idle' })
    })
  })

  // A worker runs untrusted instructions, so the server does not rely on it
  // staying confined. These are the checks that hold even if it does not.
  describe('what a worker may reach', () => {
    it('never takes work from another workspace', async () => {
      const other = await db.prisma.workspace.create({
        data: { name: 'other' },
        select: { id: true },
      })
      const theirs = await conversation(undefined, other.id)
      await db.prisma.turn.create({ data: { conversationId: theirs.id, userEventSequence: 0 } })

      expect(await db.app.$turn.claimNext(await worker('cross-tenant'))).toBeNull()
    })

    it('only lets the assigned worker claim the conversation', async () => {
      const mine = await worker('assigned-mine', { provider: 'assigned-provider' })
      const c = await conversation(mine)
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const stranger = await worker('assigned-stranger', { provider: 'assigned-provider' })

      expect(await db.app.$turn.claimNext(stranger)).toBeNull()
      expect(await db.app.$turn.claimNext(mine)).not.toBeNull()
    })

    it('does not let a stale worker renew after reassignment', async () => {
      const c = await conversation()
      const claimed = await db.prisma.turn.create({
        data: {
          conversationId: c.id,
          userEventSequence: 0,
          status: 'running',
          runningKey: String(c.id),
          leaseUntil: new Date(Date.now() + 60_000),
        },
      })
      const replacement = await worker('assigned-replacement')
      await db.prisma.conversation.update({
        where: { id: c.id },
        data: { workerId: replacement.id, providerId: replacement.providerId },
      })

      expect(await db.app.$turn.renewLease(claimed.id, c.worker.id)).toBe(false)
    })
  })

  describe('leases', () => {
    const expire = (turnId: number) =>
      db.prisma.turn.update({ where: { id: turnId }, data: { leaseUntil: new Date(0) } })

    it('returns an expired turn to the queue', async () => {
      const c = await conversation()
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(c.worker)
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
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(c.worker)

      await expire(claimed!.id)
      expect(await db.app.$turn.renewLease(claimed!.id, c.worker.id)).toBe(true)
      await db.app.$turn.reap()

      expect((await db.prisma.turn.findUniqueOrThrow({ where: { id: claimed!.id } })).status).toBe(
        'running',
      )
    })

    // The guard that stops a slow-but-alive worker from extending a lease it no
    // longer holds after the reaper handed its turn to someone else.
    it('refuses renewal from a worker that no longer holds the turn', async () => {
      const c = await conversation()
      const other = await worker('lease-other')
      await db.prisma.turn.create({ data: { conversationId: c.id, userEventSequence: 0 } })
      const claimed = await db.app.$turn.claimNext(c.worker)

      expect(await db.app.$turn.renewLease(claimed!.id, other.id)).toBe(false)
    })

    it('gives up on a turn that keeps failing instead of retrying forever', async () => {
      const c = await conversation()
      const turn = await db.prisma.turn.create({
        data: { conversationId: c.id, userEventSequence: 0, attempt: 3 },
      })
      await db.prisma.turn.update({
        where: { id: turn.id },
        data: {
          status: 'running',
          runningKey: String(c.id),
          leaseUntil: new Date(0),
        },
      })

      expect((await db.app.$turn.reap()).failed).toBeGreaterThanOrEqual(1)
      expect((await db.prisma.turn.findUniqueOrThrow({ where: { id: turn.id } })).status).toBe(
        'failed',
      )
    })
  })

  describe('materialize', () => {
    it('merges everything pending into one message and one turn', async () => {
      const c = await conversation()
      const attachment = {
        fid: 'invoice123',
        filename: '发票.pdf',
        contentType: 'application/pdf',
        size: 16,
      }
      await db.app.$pendingInput.enqueue(c.id, { text: '要报销审批' })
      await db.app.$pendingInput.enqueue(c.id, { text: '要能传发票', attachments: [attachment] })
      await db.app.$pendingInput.enqueue(c.id, { text: '超 5000 要总监批' })

      const stored = await db.app.$pendingInput.materialize(c.id)

      expect(stored?.event).toMatchObject({
        type: 'user_message',
        text: '要报销审批\n\n要能传发票\n\n超 5000 要总监批',
        attachments: [attachment],
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
      // Still pending, not lost.
      expect(await db.app.$pendingInput.list(c.id)).toHaveLength(1)
    })

    // The other half of the sentence above, which went unwritten long enough for
    // the route that closes a turn to forget to ask: once nothing is open, the
    // batch that was held back goes out.
    //
    // Its own workspace, because the claim takes the oldest turn a worker may
    // run — with the shared one it picks up whatever an earlier test left queued
    // and this test finishes someone else's turn.
    it('goes out once the turn that held it back has closed', async () => {
      const alone = await db.prisma.workspace.create({ data: { name: 'held-back' } })
      const w = await worker('materialize-after-finish', { workspaceId: alone.id })
      const c = await conversation(w)
      await db.app.$pendingInput.enqueue(c.id, { text: 'first' })
      await db.app.$pendingInput.materialize(c.id)
      await db.app.$pendingInput.enqueue(c.id, { text: 'second' })
      const claimed = await db.app.$turn.claimNext(w)

      expect(await db.app.$turn.finish(claimed?.id ?? 0, w.id, 'completed')).toBe(true)

      expect(await db.app.$pendingInput.materialize(c.id)).not.toBeNull()
      expect(await db.app.$pendingInput.list(c.id)).toEqual([])
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

      const missed = await db.app.$conversation.events(c.id, { after: 0 })

      expect(missed.map(e => e.sequence)).toEqual([1, 2])
    })
  })
})
