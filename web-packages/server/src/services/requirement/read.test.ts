import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseUrl, setupTestDb, type TestDb } from '../test-support.ts'
import { createRequirementService } from './index.ts'

describe.skipIf(!databaseUrl)('requirement reads', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({ $requirement: createRequirementService(app) }))
  }, 60_000)

  afterAll(async () => db?.close())

  const scope = (appId = db.appId) => ({ workspaceId: db.workspaceId, appId })

  const create = async (title: string, appId = db.appId) => {
    const result = await db.app.$requirement.create({
      ...scope(appId),
      createdById: db.userId,
      title,
      summary: `${title} summary`,
      body: `${title} body`,
    })
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw new Error(`requirement creation failed: ${result.kind}`)
    return result.requirement
  }

  it('returns confirmed content while retaining a newer draft for editing', async () => {
    const requirement = await create('Confirmed title')

    const confirmed = await db.app.$requirement.confirm({
      ...scope(),
      requirementId: requirement.id,
      confirmedById: db.userId,
      expectedDraftVersion: 1,
    })
    expect(confirmed.kind).toBe('ok')
    if (confirmed.kind !== 'ok')
      throw new Error(`requirement confirmation failed: ${confirmed.kind}`)
    await db.app.$requirement.saveDraft({
      ...scope(),
      requirementId: requirement.id,
      updatedById: db.userId,
      title: 'Draft title',
      summary: 'Draft summary',
      body: 'Draft body',
    })

    const page = await db.app.$requirement.list(scope(), { page: 1, pageSize: 20 })
    expect(page.items).toMatchObject([
      {
        code: requirement.code,
        title: 'Confirmed title',
        summary: 'Confirmed title summary',
        currentRevisionCode: 'v1',
        hasDraft: true,
      },
    ])
    expect(await db.app.$requirement.byCode(scope(), requirement.code)).toEqual({
      id: requirement.id,
      code: requirement.code,
    })

    const detail = await db.app.$requirement.get(scope(), requirement.id)
    expect(detail).toMatchObject({
      draft: { title: 'Draft title', version: 1 },
      currentRevision: { title: 'Confirmed title', code: 'v1' },
      revisions: [{ code: 'v1' }],
    })
    const revisionId = confirmed.requirement.currentRevision?.id
    if (revisionId === undefined) throw new Error('confirmed requirement has no current revision')
    expect(await db.app.$requirement.revision(scope(), requirement.id, revisionId)).toMatchObject({
      title: 'Confirmed title',
      code: 'v1',
    })
  })

  it('enforces workspace and app scope on every lookup', async () => {
    const requirement = await create('Scoped requirement')
    const confirmed = await db.app.$requirement.confirm({
      ...scope(),
      requirementId: requirement.id,
      confirmedById: db.userId,
      expectedDraftVersion: 1,
    })
    expect(confirmed.kind).toBe('ok')
    if (confirmed.kind !== 'ok')
      throw new Error(`requirement confirmation failed: ${confirmed.kind}`)
    const revisionId = confirmed.requirement.currentRevision?.id
    if (revisionId === undefined) throw new Error('confirmed requirement has no current revision')
    const wrongWorkspace = { workspaceId: db.workspaceId + 10_000, appId: db.appId }
    const wrongApp = { workspaceId: db.workspaceId, appId: db.appId + 10_000 }

    await expect(
      db.app.$requirement.list(wrongWorkspace, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ items: [], total: 0 })
    await expect(db.app.$requirement.get(wrongApp, requirement.id)).resolves.toBeNull()
    await expect(db.app.$requirement.byCode(wrongWorkspace, requirement.code)).resolves.toBeNull()
    await expect(
      db.app.$requirement.revision(wrongApp, requirement.id, revisionId),
    ).resolves.toBeNull()
  })

  it('uses id to stabilize pagination when update times match', async () => {
    const app = await db.prisma.app.create({
      data: {
        workspaceId: db.workspaceId,
        slug: 'requirement-pagination',
        name: 'Requirement pagination',
        createdById: db.userId,
      },
      select: { id: true },
    })
    const requirements = await Promise.all(
      ['First page', 'Second page', 'Third page'].map(title => create(title, app.id)),
    )
    await db.prisma.requirement.updateMany({
      where: { id: { in: requirements.map(requirement => requirement.id) } },
      data: { updatedAt: new Date('2099-01-01T00:00:00.000Z') },
    })

    const [first, second] = await Promise.all([
      db.app.$requirement.list(scope(app.id), { page: 1, pageSize: 2 }),
      db.app.$requirement.list(scope(app.id), { page: 2, pageSize: 2 }),
    ])
    const expected = requirements.map(requirement => requirement.id).sort((a, b) => b - a)

    expect([...first.items, ...second.items].map(requirement => requirement.id)).toEqual(expected)
    expect(first.total).toBe(3)
    expect(second.total).toBe(3)
  })
})
