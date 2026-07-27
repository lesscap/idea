import { Hono } from 'hono'
import { sessionMiddleware } from './apps/web/middleware/session.ts'
import { BASE, Routes } from './apps/web/routes.ts'
import { registerHealth } from './health.ts'
import { internal, notFound } from './http.ts'
import type { Controller, ServiceApplication, WebApplication } from './types.ts'

// Merge the services onto a fresh Hono instance so the controller sees one
// object — `app.get(...)` next to `app.workspace.roleOf()`. A sub-instance per
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

  registerHealth(root, services)

  // The session cookie is decoded for the whole web surface, including the
  // public routes: logging in has to be able to *write* a session, and accepting
  // an invitation has to be able to read one to tell "already has an account"
  // from "brand new person".
  const web = new Hono()
  web.use('*', sessionMiddleware(services.config))
  for (const [prefix, controller] of Object.entries(Routes)) {
    mount(web, prefix, controller, services)
  }
  root.route(BASE, web)

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
