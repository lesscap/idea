import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import type { Resource } from './scope.ts'

// A resource, not a service: it owns a connection pool, so it hands back a
// disposer alongside the client. Takes the url rather than an application
// context because it is built before anything else exists.
//
// `schema` is passed to the adapter rather than written into the url as
// `?schema=`. That query parameter is read by Prisma's own engine and ignored by
// node-postgres, so with a driver adapter it silently does nothing — a URL that
// looks isolated while every query lands in `public`.
export const createPrisma = (connectionString: string, schema?: string): Resource<PrismaClient> => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
  })
  return [client, () => client.$disconnect()]
}
