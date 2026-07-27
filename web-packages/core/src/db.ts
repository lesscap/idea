import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import type { Resource } from './scope.ts'

// A resource, not a service: it owns a connection pool, so it hands back a
// disposer alongside the client. Takes the url rather than an application
// context because it is built before anything else exists.
export const createPrisma = (connectionString: string): Resource<PrismaClient> => {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  return [client, () => client.$disconnect()]
}
