import { describe, expect, it, vi } from 'vitest'
import type { FileRecord } from '../../../services/file.ts'
import type { ServiceApplication } from '../../../types.ts'
import { failure, mountController, okData } from '../test-support.ts'
import { FilesController } from './files.ts'

const readyFile: FileRecord = {
  id: 1,
  fid: 'file123',
  appId: 2,
  uploadedById: 3,
  filename: '说明.md',
  contentType: 'text/markdown',
  size: 12,
  storageKey: 'idea/files/1/2/file123',
  status: 'ready',
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
}

const services = (
  file: FileRecord | null = readyFile,
  storageOver: Partial<NonNullable<ServiceApplication['$storage']>> = {},
): Partial<ServiceApplication> => ({
  $file: { getForMember: async () => file } as never,
  $storage: {
    keyFor: () => '',
    signPost: () => ({ url: '', method: 'POST', fields: {} }),
    head: async () => null,
    readText: async () => '# 标题',
    signGet: async () => 'https://oss.example/file123',
    ...storageOver,
  },
})

const mounted = (over?: Partial<ServiceApplication>) =>
  mountController(
    FilesController,
    over ?? services(),
    { userId: 7, workspaceId: 1 },
    { guarded: true },
  )

describe('file reads', () => {
  it('returns member-scoped metadata without exposing the storage key', async () => {
    const response = await mounted().request('/file123/meta')

    expect(await okData(response)).toEqual({
      fid: 'file123',
      filename: '说明.md',
      contentType: 'text/markdown',
      size: 12,
      status: 'ready',
      url: '/api/web/files/file123',
      createdAt: '2026-08-06T00:00:00.000Z',
    })
    expect(await mounted(services(null)).request('/file123/meta')).toHaveProperty('status', 404)
  })

  it('returns supported text through the JSON envelope and rejects binary files', async () => {
    const readText = vi.fn(async () => '# 标题')
    const response = await mounted(services(readyFile, { readText })).request('/file123/text')

    expect(await okData(response)).toBe('# 标题')
    expect(readText).toHaveBeenCalledWith(readyFile.storageKey)

    const binary = { ...readyFile, filename: 'book.xlsx', contentType: 'application/octet-stream' }
    const unsupported = await mounted(services(binary, { readText })).request('/file123/text')
    expect(unsupported.status).toBe(400)
    expect((await failure(unsupported)).code).toBe('file_preview_unsupported')

    const tooLarge = { ...readyFile, size: 5 * 1024 * 1024 + 1 }
    const oversized = await mounted(services(tooLarge, { readText })).request('/file123/text')
    expect(oversized.status).toBe(413)
    expect((await failure(oversized)).code).toBe('file_preview_too_large')
    expect(readText).toHaveBeenCalledOnce()
  })

  it('accepts a standard text media type with parameters', async () => {
    const readText = vi.fn(async () => '{"ready":true}')
    const file = {
      ...readyFile,
      filename: 'payload',
      contentType: 'application/json; charset=utf-8',
    }

    const response = await mounted(services(file, { readText })).request('/file123/text')

    expect(await okData(response)).toBe('{"ready":true}')
    expect(readText).toHaveBeenCalledWith(file.storageKey)
  })

  it('signs an explicit attachment response for downloads', async () => {
    const signGet = vi.fn(async () => 'https://oss.example/file123')
    const response = await mounted(services(readyFile, { signGet })).request('/file123/download')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://oss.example/file123')
    expect(signGet).toHaveBeenCalledWith(readyFile.storageKey, readyFile.filename, 'attachment')
  })
})
