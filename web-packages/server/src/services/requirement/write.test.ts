import type { RequirementDetail } from '@idea/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseUrl, setupTestDb, type TestDb } from '../test-support.ts'
import { createRequirementService } from './index.ts'

const content = (title: string) => ({ title, summary: `${title} summary`, body: `${title} body` })

describe.skipIf(!databaseUrl)('requirement writes', () => {
  let db: TestDb
  let providerId: number

  beforeAll(async () => {
    db = await setupTestDb(app => ({ $requirement: createRequirementService(app) }))
    const provider = await db.prisma.provider.create({
      data: { name: 'requirement-test', label: 'Requirement test', kind: 'claude', config: {} },
      select: { id: true },
    })
    providerId = provider.id
  }, 60_000)

  afterAll(async () => db?.close())

  const scope = () => ({ workspaceId: db.workspaceId, appId: db.appId })

  const file = (
    fid: string,
    contentType: string,
    status: 'pending' | 'ready' = 'ready',
    appId = db.appId,
  ) =>
    db.prisma.file.create({
      data: {
        fid,
        appId,
        uploadedById: db.userId,
        filename: `${fid}.${contentType.startsWith('image/') ? 'png' : 'md'}`,
        contentType,
        size: 32,
        storageKey: `requirement-tests/${fid}`,
        status,
      },
    })

  const conversation = async (appId: number, cid: string) => {
    await db.prisma.conversation.create({
      data: { cid, appId, createdById: db.userId, providerId },
    })
    return cid
  }

  const create = async (title: string, conversationCid?: string): Promise<RequirementDetail> => {
    const result = await db.app.$requirement.create({
      ...scope(),
      ...content(title),
      createdById: db.userId,
      conversationCid,
    })
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw new Error(`requirement creation failed: ${result.kind}`)
    return result.requirement
  }

  const save = (requirementId: number, title: string, conversationCid?: string) =>
    db.app.$requirement.saveDraft({
      ...scope(),
      requirementId,
      updatedById: db.userId,
      conversationCid,
      ...content(title),
    })

  const confirm = (requirementId: number, expectedDraftVersion: number, conversationCid?: string) =>
    db.app.$requirement.confirm({
      ...scope(),
      requirementId,
      confirmedById: db.userId,
      expectedDraftVersion,
      conversationCid,
    })

  it('allocates unique app-local numbers under concurrent creation', async () => {
    const created = await Promise.all([create('First'), create('Second')])

    expect(created.map(item => item.number).sort((a, b) => a - b)).toEqual([1, 2])
    expect(created.map(item => item.code).sort()).toEqual(['R-1', 'R-2'])
  })

  it('preserves draft provenance and creates immutable revision snapshots', async () => {
    const firstCid = await conversation(db.appId, 'requirement-first')
    const secondCid = await conversation(db.appId, 'requirement-second')
    const requirement = await create('Initial', firstCid)

    const preserved = await save(requirement.id, 'Preserved')
    expect(preserved).toMatchObject({
      kind: 'ok',
      requirement: {
        draft: { version: 2, updatedInConversationCid: firstCid },
      },
    })

    const moved = await save(requirement.id, 'Confirmed once', secondCid)
    expect(moved).toMatchObject({ kind: 'ok', requirement: { draft: { version: 3 } } })

    const firstRevision = await confirm(requirement.id, 3)
    expect(firstRevision).toMatchObject({
      kind: 'ok',
      requirement: {
        status: 'active',
        draft: null,
        currentRevision: {
          code: 'v1',
          title: 'Confirmed once',
          confirmedInConversationCid: secondCid,
        },
      },
    })

    await save(requirement.id, 'Confirmed twice')
    const secondRevision = await confirm(requirement.id, 1, firstCid)
    expect(secondRevision).toMatchObject({
      kind: 'ok',
      requirement: {
        currentRevision: { code: 'v2', confirmedInConversationCid: firstCid },
        revisions: [{ code: 'v2' }, { code: 'v1' }],
      },
    })

    const original = await db.prisma.requirementRevision.findFirstOrThrow({
      where: { requirementId: requirement.id, number: 1 },
    })
    expect(original).toMatchObject({ title: 'Confirmed once', summary: 'Confirmed once summary' })
  })

  it('replaces draft files and snapshots them when confirming', async () => {
    await Promise.all([
      file('requirement-image', 'image/png'),
      file('requirement-attachment', 'text/markdown'),
    ])
    const created = await db.app.$requirement.create({
      ...scope(),
      ...content('Files'),
      createdById: db.userId,
      imageFids: ['requirement-image'],
      attachmentFids: ['requirement-attachment'],
    })
    expect(created).toMatchObject({
      kind: 'ok',
      requirement: {
        draft: {
          images: [{ fid: 'requirement-image' }],
          attachments: [{ fid: 'requirement-attachment' }],
        },
      },
    })
    if (created.kind !== 'ok') throw new Error(`requirement creation failed: ${created.kind}`)

    const confirmed = await confirm(created.requirement.id, 1)
    expect(confirmed).toMatchObject({
      kind: 'ok',
      requirement: {
        draft: null,
        currentRevision: {
          images: [{ fid: 'requirement-image' }],
          attachments: [{ fid: 'requirement-attachment' }],
        },
      },
    })

    const replaced = await save(created.requirement.id, 'New draft')
    expect(replaced).toMatchObject({
      kind: 'ok',
      requirement: {
        draft: { images: [], attachments: [] },
        currentRevision: {
          images: [{ fid: 'requirement-image' }],
          attachments: [{ fid: 'requirement-attachment' }],
        },
      },
    })
  })

  it('rejects unavailable, non-image and duplicate file references', async () => {
    const otherApp = await db.prisma.app.create({
      data: {
        workspaceId: db.workspaceId,
        slug: 'requirement-file-other',
        name: 'Requirement file other',
        createdById: db.userId,
      },
    })
    await Promise.all([
      file('pending-image', 'image/png', 'pending'),
      file('not-an-image', 'text/plain'),
      file('foreign-image', 'image/png', 'ready', otherApp.id),
    ])
    const createWith = (imageFids: readonly string[], attachmentFids: readonly string[] = []) =>
      db.app.$requirement.create({
        ...scope(),
        ...content('Rejected files'),
        createdById: db.userId,
        imageFids,
        attachmentFids,
      })

    await expect(createWith(['pending-image'])).resolves.toEqual({ kind: 'file_not_ready' })
    await expect(createWith(['not-an-image'])).resolves.toEqual({ kind: 'invalid_image_file' })
    await expect(createWith(['foreign-image'])).resolves.toEqual({ kind: 'file_not_found' })
    await expect(createWith(['not-an-image'], ['not-an-image'])).resolves.toEqual({
      kind: 'duplicate_file_reference',
    })
  })

  it('allows only one confirmation of the same draft version', async () => {
    const requirement = await create('Concurrent confirmation')
    const runConfirm = () => confirm(requirement.id, 1)

    const results = await Promise.all([runConfirm(), runConfirm()])
    expect(results.map(result => result.kind).sort()).toEqual(['draft_version_conflict', 'ok'])
    expect(
      await db.prisma.requirementRevision.count({ where: { requirementId: requirement.id } }),
    ).toBe(1)
  })

  it('keeps concurrent saving and confirmation inside domain outcomes', async () => {
    const requirements = await Promise.all(
      Array.from({ length: 20 }, (_, index) => create(`Concurrent save ${index}`)),
    )
    const outcomes = await Promise.all(
      requirements.map(async requirement => {
        const [confirmed, saved] = await Promise.all([
          confirm(requirement.id, 1),
          save(requirement.id, 'Saved concurrently'),
        ])
        return {
          confirmed,
          saved,
          current: await db.app.$requirement.get(scope(), requirement.id),
        }
      }),
    )

    outcomes.forEach(({ confirmed, saved, current }) => {
      expect(saved.kind).toBe('ok')
      if (confirmed.kind === 'ok') {
        expect(current).toMatchObject({
          status: 'active',
          currentRevision: { code: 'v1' },
          draft: { title: 'Saved concurrently', version: 1 },
        })
      } else {
        expect(confirmed.kind).toBe('draft_version_conflict')
        expect(current).toMatchObject({
          status: 'draft',
          currentRevision: null,
          draft: { title: 'Saved concurrently', version: 2 },
        })
      }
    })
  })

  it('rejects a conversation from another app before allocating a number', async () => {
    const otherApp = await db.prisma.app.create({
      data: {
        workspaceId: db.workspaceId,
        slug: 'requirement-other-app',
        name: 'Requirement other app',
        createdById: db.userId,
      },
      select: { id: true },
    })
    const foreignCid = await conversation(otherApp.id, 'requirement-foreign')
    const before = await db.prisma.app.findUniqueOrThrow({
      where: { id: db.appId },
      select: { requirementSequence: true },
    })

    const result = await db.app.$requirement.create({
      ...scope(),
      ...content('Rejected'),
      createdById: db.userId,
      conversationCid: foreignCid,
    })
    const after = await db.prisma.app.findUniqueOrThrow({
      where: { id: db.appId },
      select: { requirementSequence: true },
    })

    expect(result).toEqual({ kind: 'conversation_not_found' })
    expect(after.requirementSequence).toBe(before.requirementSequence)
  })
})
