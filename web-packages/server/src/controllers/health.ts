import { sendOk } from '../http.ts'
import type { Controller } from '../types.ts'

// Routes are relative to the prefix this controller is mounted at (see
// routes.ts) — a controller never spells out its own mount path.
//
// Responses go through the helpers in http.ts rather than raw c.json, so the
// envelope and the status stay decided in one place.
export const HealthController: Controller = app => {
  app.get('/', async c => sendOk(c, await app.health.check()))
}
