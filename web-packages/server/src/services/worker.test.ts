import { sha256 } from '@idea/core'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCommandBus } from '../command-bus.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'
import { createWorkerService } from './worker.ts'

describe.skipIf(!databaseUrl)('worker registration', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      $commands: createCommandBus(),
      $worker: createWorkerService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  it('does not change the provider of an existing machine', async () => {
    await Promise.all(
      ['worker-provider-a', 'worker-provider-b'].map(name =>
        db.prisma.provider.create({
          data: { name, label: name, kind: 'claude', config: {} },
        }),
      ),
    )
    const enrolmentToken = 'provider-immutable-enrolment'
    await db.prisma.workerEnrolment.create({
      data: {
        workspaceId: db.workspaceId,
        createdById: db.userId,
        label: 'test',
        tokenHash: sha256(enrolmentToken),
      },
    })

    const input = {
      enrolmentToken,
      machineId: 'machine-stable',
      name: 'machine-stable',
      hostname: 'test.local',
    }
    const created = await db.app.$worker.register({ ...input, provider: 'worker-provider-a' })
    const mismatch = await db.app.$worker.register({ ...input, provider: 'worker-provider-b' })

    expect(created.kind).toBe('created')
    expect(mismatch.kind).toBe('provider_mismatch')
    if (created.kind !== 'created') return
    expect(
      (await db.prisma.worker.findUniqueOrThrow({ where: { id: created.worker.id } })).providerId,
    ).toBe(created.worker.providerId)
  })

  it('exposes the model-specific effort configuration of an online worker', async () => {
    const provider = await db.prisma.provider.create({
      data: {
        name: 'worker-efforts',
        label: 'Worker Efforts',
        kind: 'codex',
        config: {
          model: 'model-a',
          models: ['model-a', 'model-b'],
          efforts: { 'model-a': ['low', 'high'], 'model-b': ['minimal'] },
        },
      },
    })
    const worker = await db.prisma.worker.create({
      data: {
        workspaceId: db.workspaceId,
        providerId: provider.id,
        machineId: 'machine-efforts',
        name: 'machine-efforts',
        hostname: 'test.local',
        apiToken: sha256('worker-efforts-token'),
      },
    })
    const disconnect = db.app.$commands.subscribe(worker.id, vi.fn())

    try {
      const option = (await db.app.$worker.listOnline(db.workspaceId)).find(
        candidate => candidate.id === worker.id,
      )
      expect(option).toMatchObject({
        defaultModel: 'model-a',
        models: ['model-a', 'model-b'],
        efforts: { 'model-a': ['low', 'high'], 'model-b': ['minimal'] },
      })
    } finally {
      disconnect()
    }
  })
})
