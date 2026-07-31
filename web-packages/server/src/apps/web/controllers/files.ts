import { zValidator } from '@hono/zod-validator'
import type { CreateFileUploadResult, UploadedFile } from '@idea/shared'
import { failWith, notFound, sendOk } from '../../../http.ts'
import { MAX_FILE_BYTES } from '../../../config.ts'
import type { FileRecord } from '../../../services/file.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { CreateFileBody } from '../schema/index.ts'
import { isResponse, scopedApp } from './conversation/scoped.ts'

const fileUrl = (fid: string): string => `/api/web/files/${fid}`

const toUploadedFile = (file: FileRecord): UploadedFile => ({
  fid: file.fid,
  filename: file.filename,
  contentType: file.contentType,
  size: file.size,
  status: file.status,
  url: file.status === 'ready' ? fileUrl(file.fid) : null,
  createdAt: file.createdAt,
})

export const AppFilesController: Controller = app => {
  app.post('/', zValidator('json', CreateFileBody), async c => {
    const input = c.req.valid('json')
    if (input.size > MAX_FILE_BYTES) {
      return failWith(c, 413, 'file_too_large', `file exceeds ${MAX_FILE_BYTES} bytes`)
    }

    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const result = await app.$file.createUpload({
      workspaceId: currentApp.workspaceId,
      appId: currentApp.id,
      uploadedById: session(c).userId,
      ...input,
    })
    if (result.kind === 'storage_unavailable') {
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }

    const data: CreateFileUploadResult = {
      file: toUploadedFile(result.file),
      upload: result.upload,
    }
    return sendOk(c, data)
  })
}

export const FilesController: Controller = app => {
  app.post('/:fid/confirm', async c => {
    const result = await app.$file.confirm(session(c).userId, c.req.param('fid'))

    if (result.kind === 'not_found') return notFound(c, 'file not found')
    if (result.kind === 'not_uploaded') {
      return failWith(c, 409, 'file_not_uploaded', 'file upload has not completed')
    }
    if (result.kind === 'size_mismatch') {
      return failWith(c, 409, 'file_size_mismatch', 'uploaded file size does not match')
    }
    if (result.kind === 'storage_unavailable') {
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }
    return sendOk(c, toUploadedFile(result.file))
  })

  app.get('/:fid', async c => {
    const file = await app.$file.getForMember(session(c).userId, c.req.param('fid'))
    if (!file) return notFound(c, 'file not found')
    if (file.status !== 'ready') {
      return failWith(c, 409, 'file_not_ready', 'file upload has not been confirmed')
    }

    const storage = app.$storage
    if (!storage) {
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }

    try {
      c.header('Cache-Control', 'private, no-store')
      return c.redirect(await storage.signGet(file.storageKey, file.filename), 302)
    } catch (error) {
      globalThis.console.error('OSS signGet failed', error)
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }
  })
}
