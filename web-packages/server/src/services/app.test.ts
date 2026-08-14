import { ensureWorkspaceSystemApp } from '@idea/core'
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
      db.app.$app.update(db.workspaceId, second.app.id, { name: 'Test app' }),
    ).resolves.toEqual({ kind: 'name_taken' })
  })

  it('keeps the workspace system app outside every public app operation', async () => {
    const systemApp = await db.prisma.$transaction(tx =>
      ensureWorkspaceSystemApp(tx, db.workspaceId, db.userId),
    )
    const page = await db.app.$app.listInWorkspace(db.workspaceId, { page: 1, pageSize: 20 })

    expect(page.items.map(item => item.id)).not.toContain(systemApp.id)
    await expect(db.app.$app.getByIdInWorkspace(db.workspaceId, systemApp.id)).resolves.toBeNull()
    await expect(db.app.$app.remove(db.workspaceId, systemApp.id)).resolves.toEqual({
      kind: 'not_found',
    })
    await expect(db.app.$app.getSystemInWorkspace(db.workspaceId)).resolves.toMatchObject({
      id: systemApp.id,
    })
  })

  it('blocks active work and otherwise deletes the app data', async () => {
    const app = await db.prisma.app.create({
      data: {
        workspaceId: db.workspaceId,
        slug: 'delete-test',
        name: 'Delete test',
        createdById: db.userId,
      },
      select: { id: true },
    })
    const provider = await db.prisma.provider.create({
      data: { name: 'delete-provider', label: 'Delete provider', kind: 'claude', config: {} },
    })
    const worker = await db.prisma.worker.create({
      data: {
        workspaceId: db.workspaceId,
        providerId: provider.id,
        machineId: 'delete-worker',
        name: 'delete-worker',
        hostname: 'test',
        apiToken: 'delete-worker',
      },
    })
    const conversation = await db.prisma.conversation.create({
      data: {
        cid: 'delete-test-cid',
        appId: app.id,
        createdById: db.userId,
        providerId: provider.id,
        workerId: worker.id,
      },
      select: { id: true },
    })
    const [, , file] = await Promise.all([
      db.prisma.turn.create({
        data: { conversationId: conversation.id, userEventSequence: 0, status: 'queued' },
      }),
      db.prisma.turn.create({
        data: { conversationId: conversation.id, userEventSequence: 1, status: 'running' },
      }),
      db.prisma.file.create({
        data: {
          fid: 'delete-test-file',
          appId: app.id,
          uploadedById: db.userId,
          filename: 'test.txt',
          contentType: 'text/plain',
          size: 4,
          storageKey: 'idea/files/delete-test',
        },
      }),
    ])
    const issue = await db.prisma.issue.create({
      data: {
        appId: app.id,
        number: 1,
        createdById: db.userId,
        updatedById: db.userId,
        title: 'Delete with files',
        body: '',
        files: { create: { fileId: file.id, role: 'attachment', position: 0 } },
        revisions: {
          create: {
            number: 1,
            title: 'Delete with files',
            body: '',
            editedById: db.userId,
            files: { create: { fileId: file.id, role: 'attachment', position: 0 } },
          },
        },
      },
      select: { id: true },
    })

    await expect(db.app.$app.remove(db.workspaceId, app.id)).resolves.toEqual({
      kind: 'busy',
    })
    expect(await db.prisma.app.count({ where: { id: app.id } })).toBe(1)

    await db.prisma.turn.updateMany({
      where: { conversationId: conversation.id },
      data: { status: 'completed' },
    })
    await expect(db.app.$app.remove(db.workspaceId, app.id)).resolves.toEqual({
      kind: 'ok',
    })

    const [apps, conversations, turns, files, issues, issueFiles] = await Promise.all([
      db.prisma.app.count({ where: { id: app.id } }),
      db.prisma.conversation.count({ where: { id: conversation.id } }),
      db.prisma.turn.count({ where: { conversationId: conversation.id } }),
      db.prisma.file.count({ where: { appId: app.id } }),
      db.prisma.issue.count({ where: { id: issue.id } }),
      db.prisma.issueFile.count({ where: { issueId: issue.id } }),
    ])
    expect({ apps, conversations, turns, files, issues, issueFiles }).toEqual({
      apps: 0,
      conversations: 0,
      turns: 0,
      files: 0,
      issues: 0,
      issueFiles: 0,
    })
  })
})
