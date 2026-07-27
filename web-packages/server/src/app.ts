import { Hono } from 'hono'
import { internal, notFound } from './http.ts'
import { Routes } from './routes.ts'
import type { Controller, ServiceApplication, WebApplication } from './types.ts'

// Merge the services onto a fresh Hono instance so the controller sees one
// object — `app.get(...)` next to `app.health.check()`. A sub-instance per
// prefix is what keeps controller-registered middleware from leaking sideways.
const mount = (
  root: Hono,
  prefix: string,
  controller: Controller,
  services: ServiceApplication,
) => {
  const scoped: WebApplication = Object.assign(new Hono(), services)
  controller(scoped)
  root.route(prefix, scoped)
}

export const createApp = (services: ServiceApplication): Hono => {
  const root = new Hono()
  for (const [prefix, controller] of Object.entries(Routes)) {
    mount(root, prefix, controller, services)
  }

  // Without these two, the framework's own plain-text "404 Not Found" and
  // "Internal Server Error" escape as the only responses that are not the
  // envelope — and the browser wrapper, which parses every response as JSON,
  // reports them as an unhelpful `bad_response` instead of what they are.
  root.notFound(c => notFound(c, `no route for ${c.req.method} ${c.req.path}`))

  root.onError((err, c) => {
    // The stack goes to the log; the client gets a generic message. An
    // unhandled error here is frequently a database or driver failure, and
    // those messages carry connection details.
    console.error('unhandled error', err)
    return internal(c)
  })

  return root
}
