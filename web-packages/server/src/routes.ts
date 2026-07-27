import { HealthController } from './controllers/health.ts'
import type { Controller } from './types.ts'

// Because a controller is `(app) => void`, cross-cutting concerns are ordinary
// function wrappers. Middleware registered inside the wrapper lands on the
// controller's own sub-instance, so it applies to that prefix and nothing else.
//
// export const guarded = (controller: Controller): Controller => app => {
//   app.use('*', requireSession)
//   controller(app)
// }

// The complete HTTP surface: prefix → controller. Public routes go above the
// auth gate, guarded ones below it, so the file reads as the access policy.
export const Routes: Record<string, Controller> = {
  '/health': HealthController,
}
