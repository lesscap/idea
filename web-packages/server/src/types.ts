import type { PrismaClient } from '@idea/core'
import type { Hono } from 'hono'
import type { CommandBus } from './command-bus.ts'
import type { Config } from './config.ts'
import type { AppService } from './services/app.ts'
import type { AuthService } from './services/auth.ts'
import type { ConversationService } from './services/conversation.ts'
import type { HealthService } from './services/health.ts'
import type { PendingInputService } from './services/pending-input.ts'
import type { TurnService } from './services/turn.ts'
import type { UserService } from './services/user.ts'
import type { WorkerService } from './services/worker.ts'
import type { WorkspaceService } from './services/workspace.ts'

// Everything a service factory can reach: the config, the resources, and its
// sibling services. Assembled once at boot by createContext.
//
// Every member is `$`-prefixed. A controller receives `Hono & ServiceApplication`
// — framework methods and our services live on the same object — and the sigil
// is what tells them apart at a glance: `app.get(...)` is Hono, `app.$workspace`
// is ours. Without it, `app.app.create()` and `app.use()` read alike.
export type ServiceApplication = {
  readonly $config: Config
  readonly $prisma: PrismaClient
  readonly $health: HealthService
  readonly $user: UserService
  readonly $auth: AuthService
  readonly $workspace: WorkspaceService
  readonly $app: AppService
  readonly $conversation: ConversationService
  readonly $pendingInput: PendingInputService
  readonly $turn: TurnService
  readonly $worker: WorkerService
  readonly $commands: CommandBus
}

// A service is `(app) => api`: a factory closing over the application, handing
// back a plain object of functions. No classes, no `this`. Factories that own a
// resource return a `Resource` tuple instead so the scope can release it.
export type Service<T> = (app: ServiceApplication) => T

// What a controller receives: a Hono instance with the services merged onto it,
// so `app.get(...)` and `app.$user.currentUser()` read off the same object. Each
// controller gets its own sub-instance, so middleware it registers stays scoped
// to that controller's prefix.
export type WebApplication = Hono & ServiceApplication

// A controller is `(app) => void`: it registers routes and returns nothing.
// Same arity as a service, so wrappers compose — see `guarded` in routes.ts.
export type Controller = (app: WebApplication) => void
