import type { Controller } from '../../types.ts'
import { WorkerFilesController } from './controllers/files.ts'
import { TurnsController } from './controllers/turns.ts'
import { WorkersController } from './controllers/workers.ts'
import { workerAuth } from './middleware/auth.ts'

// The daemon-facing surface. Bearer tokens only — it shares no middleware with
// /api/web, which is what makes "session or token?" answerable from the
// directory a route lives in.
export const BASE = '/api/worker'

const guarded =
  (controller: Controller): Controller =>
  app => {
    app.use('*', workerAuth(app))
    controller(app)
  }

// `/workers` is deliberately NOT guarded: POST is registration, and a daemon
// starting for the first time has no token to present. Its other routes apply
// the middleware individually.
export const Routes: Record<string, Controller> = {
  '/workers': WorkersController,
  '/files': guarded(WorkerFilesController),
  '/turns': guarded(TurnsController),
}
