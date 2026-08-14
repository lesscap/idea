import type { IssueDetail } from '@idea/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseUrl, setupTestDb, type TestDb } from '../test-support.ts'
import { createIssueService } from './index.ts'

describe.skipIf(!databaseUrl)('issue service', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await setupTestDb(app => ({ $issue: createIssueService(app) }))
  }, 60_000)

  afterAll(async () => db?.close())

  const scope = () => ({ workspaceId: db.workspaceId, appId: db.appId })
  const create = async (title: string): Promise<IssueDetail> => {
    const result = await db.app.$issue.create({
      ...scope(),
      title,
      body: `${title} body`,
      type: null,
      createdById: db.userId,
    })
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw new Error(`issue creation failed: ${result.kind}`)
    return result.issue
  }

  it('allocates app-local numbers and keeps immutable content revisions', async () => {
    const created = await Promise.all([create('First'), create('Second')])
    expect(created.map(issue => issue.number).sort((left, right) => left - right)).toEqual([1, 2])

    const issue = created[0]
    await new Promise(resolve => setTimeout(resolve, 2))
    const updates = await Promise.all([
      db.app.$issue.update({
        ...scope(),
        issueNumber: issue.number,
        expectedUpdatedAt: issue.updatedAt,
        title: 'First updated A',
        body: 'A',
        type: 'feature',
        labelIds: [],
        updatedById: db.userId,
      }),
      db.app.$issue.update({
        ...scope(),
        issueNumber: issue.number,
        expectedUpdatedAt: issue.updatedAt,
        title: 'First updated B',
        body: 'B',
        type: 'bug',
        labelIds: [],
        updatedById: db.userId,
      }),
    ])
    expect(updates.map(result => result.kind).sort()).toEqual(['ok', 'update_conflict'])

    const revisions = await db.prisma.issueRevision.findMany({
      where: { issueId: issue.id },
      orderBy: { number: 'asc' },
      select: { number: true, title: true },
    })
    expect(revisions).toHaveLength(2)
    expect(revisions[0]).toEqual({ number: 1, title: 'First' })
  })

  it('updates content and metadata atomically', async () => {
    const issue = await create('Atomic issue')
    const label = await db.app.$issue.createLabel({
      ...scope(),
      name: 'Atomic',
      description: null,
      color: '1f6feb',
    })
    expect(label.kind).toBe('ok')
    if (label.kind !== 'ok') throw new Error(`label creation failed: ${label.kind}`)

    const updated = await db.app.$issue.update({
      ...scope(),
      issueNumber: issue.number,
      expectedUpdatedAt: issue.updatedAt,
      title: 'Atomic issue updated',
      body: 'Updated body',
      type: 'task',
      labelIds: [label.label.id],
      updatedById: db.userId,
    })

    expect(updated).toMatchObject({
      kind: 'ok',
      issue: {
        title: 'Atomic issue updated',
        body: 'Updated body',
        type: 'task',
        revisionNumber: 2,
        labels: [{ id: label.label.id }],
      },
    })
    const history = await db.app.$issue.history(scope(), issue.number)
    expect(history?.map(entry => entry.kind)).toEqual(
      expect.arrayContaining(['revision', 'type_changed', 'label_added']),
    )
  })

  it('rolls back content when full-edit validation fails', async () => {
    const issue = await create('Rollback issue')

    const result = await db.app.$issue.update({
      ...scope(),
      issueNumber: issue.number,
      expectedUpdatedAt: issue.updatedAt,
      title: 'Must not persist',
      body: 'Must not persist',
      type: 'bug',
      labelIds: [999_999],
      updatedById: db.userId,
    })

    expect(result).toEqual({ kind: 'label_not_found' })
    await expect(db.app.$issue.get(scope(), issue.number)).resolves.toMatchObject({
      title: 'Rollback issue',
      body: 'Rollback issue body',
      type: null,
      revisionNumber: 1,
      labels: [],
    })
    await expect(
      db.prisma.issueRevision.count({ where: { issueId: issue.id } }),
    ).resolves.toBe(1)
  })

  it('audits type, label, state, and label deletion changes', async () => {
    const issue = await create('Audited issue')
    const label = await db.app.$issue.createLabel({
      ...scope(),
      name: 'Needs review',
      description: null,
      color: '8250df',
    })
    expect(label.kind).toBe('ok')
    if (label.kind !== 'ok') throw new Error(`label creation failed: ${label.kind}`)

    await db.app.$issue.setType({
      ...scope(),
      issueNumber: issue.number,
      actorId: db.userId,
      type: 'task',
    })
    await db.app.$issue.setLabels({
      ...scope(),
      issueNumber: issue.number,
      actorId: db.userId,
      labelIds: [label.label.id],
    })
    await db.app.$issue.close({
      ...scope(),
      issueNumber: issue.number,
      actorId: db.userId,
      closeReason: 'completed',
    })
    await db.app.$issue.reopen({
      ...scope(),
      issueNumber: issue.number,
      actorId: db.userId,
    })
    await db.app.$issue.deleteLabel({
      ...scope(),
      labelId: label.label.id,
      actorId: db.userId,
    })

    const history = await db.app.$issue.history(scope(), issue.number)
    expect(history?.map(entry => entry.kind)).toEqual(
      expect.arrayContaining([
        'revision',
        'type_changed',
        'label_added',
        'state_changed',
        'label_removed',
      ]),
    )
    expect(history).toContainEqual(
      expect.objectContaining({
        kind: 'label_removed',
        labelId: null,
        labelName: 'Needs review',
        labelColor: '8250df',
      }),
    )
    await expect(db.app.$issue.get(scope(), issue.number)).resolves.toMatchObject({
      state: 'open',
      closeReason: null,
      type: 'task',
      labels: [],
    })
  })

  it('enforces app-scoped case-insensitive label names', async () => {
    const first = await db.app.$issue.createLabel({
      ...scope(),
      name: 'Backend',
      description: null,
      color: '0e8a16',
    })
    const duplicate = await db.app.$issue.createLabel({
      ...scope(),
      name: 'backend',
      description: null,
      color: '1d76db',
    })
    expect(first.kind).toBe('ok')
    expect(duplicate).toEqual({ kind: 'label_name_taken' })
  })
})
