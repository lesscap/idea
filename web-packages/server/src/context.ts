import { createPrisma, createScope, type Dispose } from '@idea/core'
import { createCommandBus } from './command-bus.ts'
import type { Config } from './config.ts'
import { createEventBus } from './event-bus.ts'
import { createAppService } from './services/app.ts'
import { createAuthService } from './services/auth.ts'
import { createConversationService } from './services/conversation/index.ts'
import { createFileService } from './services/file.ts'
import { createHealthService } from './services/health.ts'
import { createPendingInputService } from './services/pending-input.ts'
import { createProviderService } from './services/provider.ts'
import { createRequirementService } from './services/requirement/index.ts'
import { createStorageService } from './services/storage.ts'
import { createTurnService } from './services/turn.ts'
import { createUserService } from './services/user.ts'
import { createWorkerService } from './services/worker.ts'
import { createWorkspaceService } from './services/workspace.ts'
import type { ServiceApplication } from './types.ts'

// Boot wiring: resources first (they need releasing), then services, in
// dependency order. Written out by name rather than iterated over a registry,
// so the dependency graph is readable and the compiler checks it.
//
// The one rule for service factories: close over `app`, don't *call* a sibling
// service during construction. Methods run long after this function returns, by
// which point every service is present — which is what lets `auth` use `user`.
export const createContext = (config: Config): [ServiceApplication, Dispose] => {
  const scope = createScope()
  const prisma = scope.use(createPrisma(config.databaseUrl))
  const storage = config.oss ? createStorageService(config.oss) : null

  const app = { $config: config, $prisma: prisma, $storage: storage } as ServiceApplication
  Object.assign(app, {
    $health: createHealthService(app),
    $user: createUserService(app),
    $auth: createAuthService(app),
    $workspace: createWorkspaceService(app),
    $app: createAppService(app),
    $file: createFileService(app),
    $conversation: createConversationService(app),
    $pendingInput: createPendingInputService(app),
    $provider: createProviderService(app),
    $requirement: createRequirementService(app),
    $turn: createTurnService(app),
    $worker: createWorkerService(app),
    // Not a resource: it holds only live subscriptions, which end with their
    // connections rather than needing release.
    $commands: createCommandBus(),
    $events: createEventBus(),
  })

  return [app, scope.dispose]
}
