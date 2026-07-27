import type { PrismaClient } from '@idea/core'
import type { Hono } from 'hono'
import type { Config } from './config.ts'
import type { HealthService } from './services/health.ts'

// Everything a service factory can reach: the config, the resources, and its
// sibling services. Assembled once at boot by createContext.
export type ServiceApplication = {
  readonly config: Config
  readonly prisma: PrismaClient
  readonly health: HealthService
}

// A service is `(app) => api`: a factory closing over the application, handing
// back a plain object of functions. No classes, no `this`. Factories that own a
// resource return a `Resource` tuple instead so the scope can release it.
export type Service<T> = (app: ServiceApplication) => T

// What a controller receives: a Hono instance with the services merged onto it,
// so `app.get(...)` and `app.health.check()` read off the same object. Each
// controller gets its own sub-instance, so middleware it registers stays scoped
// to that controller's prefix.
export type WebApplication = Hono & ServiceApplication

// A controller is `(app) => void`: it registers routes and returns nothing.
// Same arity as a service, so wrappers compose — see `guarded` in routes.ts.
export type Controller = (app: WebApplication) => void
