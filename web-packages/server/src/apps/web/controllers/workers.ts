import { notFound, sendOk } from '../../../http.ts'
import type { Controller } from '../../../types.ts'
import { scopedApp } from '../services/scope/app.ts'
import { isResponse } from '../services/scope/workspace.ts'

// Workers available to a person starting or relocating a conversation. Only
// live rows cross this boundary; liveness remains the command stream, not a
// timestamp copied into the database.
export const AppWorkersController: Controller = app => {
  app.get('/', async c => {
    const currentApp = await scopedApp(app, c)
    if (isResponse(currentApp)) return currentApp
    if (!currentApp) return notFound(c, 'app not found')

    const workers = await app.$worker.listOnline(currentApp.workspaceId)
    return sendOk(c, {
      items: workers.map(
        ({
          id,
          name,
          hostname,
          providerId,
          providerLabel,
          providerKind,
          defaultModel,
          models,
          efforts,
        }) => ({
          id,
          name,
          hostname,
          providerId,
          providerLabel,
          providerKind,
          defaultModel,
          models,
          efforts,
        }),
      ),
    })
  })
}
