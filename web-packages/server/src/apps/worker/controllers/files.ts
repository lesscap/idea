import { failWith, notFound } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { currentWorker } from '../middleware/auth.ts'

export const WorkerFilesController: Controller = app => {
  app.get('/:fid', async c => {
    const worker = currentWorker(c)
    const file = await app.$file.getReadyForWorkspace(worker.workspaceId, c.req.param('fid'))
    if (!file) return notFound(c, 'file not found')

    const storage = app.$storage
    if (!storage) {
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }

    try {
      c.header('Cache-Control', 'private, no-store')
      return c.redirect(await storage.signGet(file.storageKey, file.filename), 302)
    } catch (error) {
      globalThis.console.error('OSS signGet for worker failed', error)
      return failWith(c, 503, 'storage_unavailable', 'object storage is unavailable')
    }
  })
}
