import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppService } from './app.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'

describe.skipIf(!databaseUrl)('app uniqueness', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({ $app: createAppService(app) }))
  }, 60_000)

  afterAll(async () => db?.close())

  it('maps database slug and name constraints to their write results', async () => {
    const duplicateSlug = await db.app.$app.create({
      workspaceId: db.workspaceId,
      slug: 'test-app',
      name: 'Another app',
      description: null,
      createdById: db.userId,
    })
    const second = await db.app.$app.create({
      workspaceId: db.workspaceId,
      slug: 'second-app',
      name: 'Second app',
      description: null,
      createdById: db.userId,
    })

    expect(duplicateSlug).toEqual({ kind: 'slug_taken' })
    expect(second.kind).toBe('ok')
    if (second.kind !== 'ok') return

    await expect(
      db.app.$app.update(db.workspaceId, second.app.slug, { name: 'Test app' }),
    ).resolves.toEqual({ kind: 'name_taken' })
  })
})
