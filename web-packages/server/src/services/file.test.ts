import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFileService } from './file.ts'
import type { StorageService } from './storage.ts'
import { databaseUrl, setupTestDb, type TestDb } from './test-support.ts'

describe.skipIf(!databaseUrl)('file persistence and access', () => {
  let db: TestDb
  let storedSize: number | null = null
  const head = vi.fn(async () => (storedSize === null ? null : { size: storedSize }))

  const storage: StorageService = {
    keyFor: (workspaceId, appId, fid) => `idea/files/${workspaceId}/${appId}/${fid}`,
    signPost: key => ({ url: 'https://oss.example/', method: 'POST', fields: { key } }),
    head,
    readText: async () => '',
    signGet: async key => `https://oss.example/${key}`,
  }

  beforeAll(async () => {
    db = await setupTestDb(app => ({
      $storage: storage,
      $file: createFileService(app),
    }))
  }, 60_000)

  afterAll(async () => db?.close())

  const create = async () => {
    const result = await db.app.$file.createUpload({
      workspaceId: db.workspaceId,
      appId: db.appId,
      uploadedById: db.userId,
      filename: 'brief.pdf',
      contentType: 'application/pdf',
      size: 16,
    })
    if (result.kind !== 'ok') throw new Error(`unexpected ${result.kind}`)
    return result.file
  }

  it('moves from pending to ready after HEAD and confirms idempotently', async () => {
    const file = await create()
    expect(file.status).toBe('pending')

    storedSize = 16
    const confirmed = await db.app.$file.confirm(db.userId, file.fid)
    expect(confirmed).toMatchObject({ kind: 'ok', file: { status: 'ready' } })

    const calls = head.mock.calls.length
    expect(await db.app.$file.confirm(db.userId, file.fid)).toMatchObject({ kind: 'ok' })
    expect(head).toHaveBeenCalledTimes(calls)
  })

  it('allows workspace colleagues and hides the file from outsiders', async () => {
    const file = await create()
    const colleague = await db.prisma.user.create({
      data: {
        username: `colleague-${Date.now()}`,
        passwordHash: 'x',
        name: 'colleague',
        workspaces: { create: { workspaceId: db.workspaceId } },
      },
      select: { id: true },
    })
    const outsider = await db.prisma.user.create({
      data: {
        username: `outsider-${Date.now()}`,
        passwordHash: 'x',
        name: 'outsider',
      },
      select: { id: true },
    })

    expect(await db.app.$file.getForMember(colleague.id, file.fid)).toMatchObject({
      fid: file.fid,
    })
    expect(await db.app.$file.getForMember(outsider.id, file.fid)).toBeNull()

    storedSize = 16
    await db.app.$file.confirm(db.userId, file.fid)
    expect(await db.app.$file.getReadyForWorkspace(db.workspaceId, file.fid)).toMatchObject({
      fid: file.fid,
    })
    expect(await db.app.$file.getReadyForWorkspace(db.workspaceId + 1, file.fid)).toBeNull()
  })

  it('resolves ready attachments inside one app in request order', async () => {
    const first = await create()
    const second = await create()
    storedSize = 16
    await db.app.$file.confirm(db.userId, first.fid)
    await db.app.$file.confirm(db.userId, second.fid)

    const resolved = await db.app.$file.resolveAttachments(db.appId, [second.fid, first.fid])
    expect(resolved).toMatchObject({
      kind: 'ok',
      attachments: [{ fid: second.fid }, { fid: first.fid }],
    })

    const pending = await create()
    expect(await db.app.$file.resolveAttachments(db.appId, [pending.fid])).toEqual({
      kind: 'not_ready',
    })
    expect(await db.app.$file.resolveAttachments(db.appId + 1, [first.fid])).toEqual({
      kind: 'not_found',
    })
  })
})
