import type { Hono } from 'hono'
import { sendOk } from './http.ts'
import type { ServiceApplication } from './types.ts'

// Mounted at the root, outside /api/web: this is for load balancers and
// deployment probes, not for any client application. One route, so it gets a
// function rather than a controller directory of its own.
export const registerHealth = (root: Hono, services: ServiceApplication): void => {
  root.get('/health', async c => sendOk(c, await services.$health.check()))
}
