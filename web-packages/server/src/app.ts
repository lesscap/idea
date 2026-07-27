import { Hono } from 'hono'
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
  return root
}
