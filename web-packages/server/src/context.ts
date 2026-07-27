import { createPrisma, createScope, type Dispose } from '@idea/core'
import type { Config } from './config.ts'
import { createAppService } from './services/app.ts'
import { createAuthService } from './services/auth.ts'
import { createHealthService } from './services/health.ts'
import { createUserService } from './services/user.ts'
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

  const app = { config, prisma } as ServiceApplication
  Object.assign(app, {
    health: createHealthService(app),
    user: createUserService(app),
    auth: createAuthService(app),
    workspace: createWorkspaceService(app),
    app: createAppService(app),
  })

  return [app, scope.dispose]
}
