import { zValidator } from '@hono/zod-validator'
import type { CreateFileUploadResult, UploadedFile } from '@idea/shared'
import { MAX_FILE_BYTES } from '../../../config.ts'
import { failWith, notFound, sendOk } from '../../../http.ts'
import type { FileRecord } from '../../../services/file.ts'
import type { Controller } from '../../../types.ts'
import { session } from '../middleware/session.ts'
import { CreateFileBody } from '../schema/index.ts'
import { scopedApp } from '../services/scope/app.ts'
import { isResponse } from '../services/scope/workspace.ts'

const fileUrl = (fid: string): string => `/api/web/files/${fid}`
const MAX_TEXT_PREVIEW_BYTES = 5 * 1024 * 1024
const TEXT_FILENAME =
  /\.(?:txt|log|csv|tsv|json|xml|ya?ml|toml|ini|conf|css|s[ac]ss|less|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|kts|c|h|cc|cpp|hpp|sql|sh|bash|zsh)$/i

const isTextPreview = (file: FileRecord): boolean => {
  const contentType = file.contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  const filename = file.filename.toLowerCase()
  return (
    contentType.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/javascript'].includes(contentType) ||
    ['.md', '.markdown', '.html', '.htm'].some(extension => filename.endsWith(extension)) ||
    TEXT_FILENAME.test(filename)
  )
}

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

  app.get('/:fid/meta', async c => {
    const file = await app.$file.getForMember(session(c).userId, c.req.param('fid'))
    return file ? sendOk(c, toUploadedFile(file)) : notFound(c, 'file not found')
  })

  app.get('/:fid/text', async c => {
    const file = await app.$file.getForMember(session(c).userId, c.req.param('fid'))
    if (!file) return notFound(c, 'file not found')
    if (file.status !== 'ready') {
      return failWith(c, 409, 'file_not_ready', 'file upload has not been confirmed')
    }
    if (!isTextPreview(file)) {
      return failWith(c, 400, 'file_preview_unsupported', 'file is not a supported text format')
    }
    if (file.size > MAX_TEXT_PREVIEW_BYTES) {
      return failWith(
        c,
        413,
        'file_preview_too_large',
        `text preview exceeds ${MAX_TEXT_PREVIEW_BYTES} bytes`,
      )
    }

    const storage = app.$storage
    if (!storage) {
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }

    try {
      c.header('Cache-Control', 'private, no-store')
      return sendOk(c, await storage.readText(file.storageKey))
    } catch (error) {
      globalThis.console.error('OSS readText failed', error)
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }
  })

  app.get('/:fid/download', async c => {
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
      return c.redirect(await storage.signGet(file.storageKey, file.filename, 'attachment'), 302)
    } catch (error) {
      globalThis.console.error('OSS signGet for download failed', error)
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }
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
