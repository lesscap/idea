import { ok } from '@idea/shared'
import type { Controller } from '../types.ts'

// Routes are relative to the prefix this controller is mounted at (see
// routes.ts) — a controller never spells out its own mount path.
export const HealthController: Controller = app => {
  app.get('/', async c => c.json(ok(await app.health.check())))
}
