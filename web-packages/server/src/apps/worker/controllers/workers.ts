import { zValidator } from '@hono/zod-validator'
import type { WorkerCommand } from '../../../command-bus.ts'
import { badRequest, conflict, sendOk, unauthorized } from '../../../http.ts'
import { streamBus } from '../../../sse.ts'
import type { Controller } from '../../../types.ts'
import { currentWorker, workerAuth } from '../middleware/auth.ts'
import { RegisterWorkerBody } from '../schema/index.ts'

// Registration, the command stream, and the watchdog.
//
// NOTE: registration is mounted WITHOUT workerAuth — a daemon registering for
// the first time has no token yet. Everything below it applies the middleware
// individually. Do not wrap this controller.
export const WorkersController: Controller = app => {
  // Idempotent on identity, anchored on machineId. A restarted daemon recovers
  // its worker row rather than accumulating duplicates; the token is reissued
  // every time, because only its hash is stored and the old one could not be
  // handed back even in principle.
  app.post('/', zValidator('json', RegisterWorkerBody), async c => {
    const result = await app.$worker.register(c.req.valid('json'))

    // One flat answer for an unknown token. Saying "no such workspace" versus
    // "wrong token" would let whoever holds a bad token probe for which
    // workspaces exist.
    if (result.kind === 'not_enrolled') return unauthorized(c, 'enrolment token is not valid')

    if (result.kind === 'unknown_provider')
      return badRequest(c, 'no such provider, or it is turned off')

    if (result.kind === 'name_collision')
      return conflict(
        c,
        `the name "${result.existing.name}" is already used by ${result.existing.hostname}`,
      )

    return sendOk(c, {
      worker: result.worker,
      apiToken: result.apiToken,
      outcome: result.kind,
    })
  })

  // The non-secret half of the provider registry: endpoints and model names, and
  // the NAME of the environment variable each credential lives in — never a
  // credential. A worker reads this at boot to work out which providers it can
  // actually serve, and reports those as its capabilities.
  app.get('/providers', workerAuth(app), async c =>
    sendOk(c, { items: await app.$provider.listEnabled() }),
  )

  // The command stream, and the only definition of "this worker is usable".
  // Live-only: nothing is replayed on reconnect because nothing durable lives
  // here — the queue is in the database, and a worker that missed a nudge finds
  // the work by asking.
  app.get('/me/stream', workerAuth(app), c => {
    const worker = currentWorker(c)

    return streamBus<WorkerCommand>(
      c,
      push => app.$commands.subscribe(worker.id, push),
      command => JSON.stringify(command),
      {
        // Its child processes died with it, so every turn it held is already
        // abandoned. Releasing now beats waiting out leases nobody will renew.
        onClose: () => void app.$turn.releaseWorker(worker.id),
      },
    )
  })

  // For the daemon's own watchdog. The server records nothing: a worker is
  // usable exactly while its command stream is connected, so there is no
  // last-seen column to write and no timeout to tune. This endpoint exists so
  // the daemon can discover it has lost the server and exit for its supervisor
  // to restart it clean.
  app.post('/heartbeat', workerAuth(app), c => sendOk(c, { ok: true }))
}
