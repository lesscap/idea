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

  const file = (fid: string, contentType: string) =>
    db.prisma.file.create({
      data: {
        fid,
        appId: db.appId,
        uploadedById: db.userId,
        filename: fid,
        contentType,
        size: 8,
        storageKey: `requirement-read-tests/${fid}`,
        status: 'ready',
      },
    })

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

  it('returns ordered file descriptors from a historical revision', async () => {
    await Promise.all([file('read-image-a', 'image/png'), file('read-image-b', 'image/jpeg')])
    const created = await db.app.$requirement.create({
      ...scope(),
      createdById: db.userId,
      title: 'Requirement files',
      summary: '',
      body: '![B](idea-file:read-image-b)',
      imageFids: ['read-image-b', 'read-image-a'],
    })
    expect(created.kind).toBe('ok')
    if (created.kind !== 'ok') throw new Error(`requirement creation failed: ${created.kind}`)
    const confirmed = await db.app.$requirement.confirm({
      ...scope(),
      requirementId: created.requirement.id,
      confirmedById: db.userId,
      expectedDraftVersion: 1,
    })
    expect(confirmed.kind).toBe('ok')
    if (confirmed.kind !== 'ok')
      throw new Error(`requirement confirmation failed: ${confirmed.kind}`)
    const revisionId = confirmed.requirement.currentRevision?.id
    if (revisionId === undefined) throw new Error('confirmed requirement has no current revision')

    await expect(
      db.app.$requirement.revision(scope(), created.requirement.id, revisionId),
    ).resolves.toMatchObject({ images: [{ fid: 'read-image-b' }, { fid: 'read-image-a' }] })
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

  it('searches the same requirement content that the list displays', async () => {
    const draftOnly = await create('Needle Draft Alpha')
    const confirmed = await create('Needle Confirmed Beta')
    const confirmation = await db.app.$requirement.confirm({
      ...scope(),
      requirementId: confirmed.id,
      confirmedById: db.userId,
      expectedDraftVersion: 1,
    })
    expect(confirmation.kind).toBe('ok')
    await db.app.$requirement.saveDraft({
      ...scope(),
      requirementId: confirmed.id,
      updatedById: db.userId,
      title: 'Hidden Draft Gamma',
      summary: 'Hidden Draft Gamma summary',
      body: 'Hidden Draft Gamma body',
    })

    const search = (value: string) =>
      db.app.$requirement.list(scope(), { page: 1, pageSize: 20, search: value })

    await expect(search('needle draft alpha')).resolves.toMatchObject({
      items: [{ id: draftOnly.id }],
      total: 1,
    })
    await expect(search('NEEDLE CONFIRMED BETA')).resolves.toMatchObject({
      items: [{ id: confirmed.id }],
      total: 1,
    })
    await expect(search('confirmed beta summary')).resolves.toMatchObject({
      items: [{ id: confirmed.id }],
      total: 1,
    })
    await expect(search('Hidden Draft Gamma')).resolves.toMatchObject({ items: [], total: 0 })
    await expect(search(confirmed.code.toLowerCase())).resolves.toMatchObject({
      items: [{ id: confirmed.id }],
      total: 1,
    })
  })
})
