import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { FileRecord, FileService } from '../../../services/file.ts'
import type { StorageService } from '../../../services/storage.ts'
import type { WebApplication } from '../../../types.ts'
import { WorkerFilesController } from './files.ts'

const WORKER = { id: 7, workspaceId: 11, providerId: 1, agentKind: 'claude' }

const stub = <T>(calls: Partial<T>): T => calls as T

const file: FileRecord = {
  id: 1,
  fid: 'file123',
  appId: 5,
  uploadedById: 7,
  filename: 'brief.pdf',
  contentType: 'application/pdf',
  size: 16,
  storageKey: 'idea/files/11/5/file123',
  status: 'ready',
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
}

const mount = (found: FileRecord | null) => {
  const getReadyForWorkspace = vi.fn(async () => found)
  const storage: Partial<StorageService> = {
    signGet: async () => 'https://oss.example/brief.pdf',
  }
  const app = Object.assign(new Hono(), {
    $file: stub<FileService>({ getReadyForWorkspace }),
    $storage: stub<StorageService>(storage),
  }) as WebApplication
  const asWorker: MiddlewareHandler = async (c, next) => {
    c.set('worker' as never, WORKER as never)
    await next()
  }
  app.use('*', asWorker)
  WorkerFilesController(app)
  return { app, getReadyForWorkspace }
}

describe('worker file access', () => {
  it('signs a ready file through the worker workspace', async () => {
    const { app, getReadyForWorkspace } = mount(file)
    const response = await app.request('/file123')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://oss.example/brief.pdf')
    expect(getReadyForWorkspace).toHaveBeenCalledWith(WORKER.workspaceId, file.fid)
  })

  it('does not reveal a file outside the worker workspace', async () => {
    const { app } = mount(null)
    expect((await app.request('/other-file')).status).toBe(404)
  })
})
