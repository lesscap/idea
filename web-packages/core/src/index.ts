// The backend kernel: persistence plus the resource-wiring primitive every
// long-lived process needs. Consumers reach Prisma through here rather than
// depending on @prisma/client directly, so the ORM stays swappable behind one
// package boundary.

export type { PrismaClient } from '@prisma/client'
export { createPrisma } from './db.ts'
export { createScope, type Dispose, type Resource, type Scope } from './scope.ts'
