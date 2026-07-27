// Loaded here rather than in a vitest setup file: this module is the only thing
// that needs a database, so the dependency stays visible where it is used.
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { createPrisma, type PrismaClient } from '@idea/core'
import type { ServiceApplication } from '../types.ts'

// A real database for the service tests that need one.
//
// Its sibling, apps/web/test-support.ts, stubs every service so controller tests
// run without a database — and says that needing more than a stub means the
// controller grew a dependency it should not have. That rule holds there and
// does not reach here, because these tests are about the database itself.
//
// Nothing about turn claiming can be checked with a mock: the mechanism is a
// unique index rejecting a second concurrent write, and a fake `$prisma` would
// only confirm that the code calls the functions its author expected. These
// tests exist to catch the cases where the author expected wrong — which has
// already happened twice while writing them.
//
// Each run gets its own Postgres schema, created and dropped around the suite,
// so the shared development data in `public` is never touched.
//
// The isolation needs BOTH halves below, because the two tools disagree about
// where a schema is configured:
//
//   prisma CLI   reads `?schema=` from the url  (it goes through the engine)
//   the client   ignores it entirely            (it goes through the pg adapter)
//
// Setting only the url produces a run that looks isolated while every query
// lands in `public`. That is not hypothetical — it is what this file did first.

const url = (): string | null => {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  return base?.startsWith('postgres') ? base : null
}

// Skips rather than fails when there is no database, so a contributor without
// one still gets a green suite for everything else — and the skip names itself
// in the output rather than quietly reporting nothing.
export const databaseUrl = url()

const withSchema = (base: string, schema: string): string => {
  const parsed = new URL(base)
  parsed.searchParams.set('schema', schema)
  return parsed.toString()
}

export type TestDb = {
  app: ServiceApplication
  prisma: PrismaClient
  // Rows every test can hang things off, created once with the schema.
  workspaceId: number
  userId: number
  close: () => Promise<void>
}

// Per process and per vitest worker, so parallel runs cannot collide.
const schemaName = () => `idea_test_${process.pid}_${process.env.VITEST_WORKER_ID ?? '0'}`

export const setupTestDb = async (
  services: (app: ServiceApplication) => Record<string, unknown>,
): Promise<TestDb> => {
  const base = databaseUrl
  if (!base) throw new Error('no database configured')

  const schema = schemaName()

  // The tables come from the committed migrations — never from DDL written
  // here. Hand-written CREATE TABLE in a test fixture is a second definition of
  // the schema that drifts from the real one, and the drift shows up as tests
  // passing against tables production does not have. `migrate deploy` also
  // creates the schema itself, so there is no bootstrap step.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: new URL('../../../core', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: withSchema(base, schema) },
    stdio: 'pipe',
  })

  const [prisma, dispose] = createPrisma(base, schema)
  const app = { $prisma: prisma } as ServiceApplication
  Object.assign(app, services(app))

  const user = await prisma.user.create({
    data: { username: `t${Date.now()}`, passwordHash: 'x', name: 'tester' },
    select: { id: true },
  })
  const workspace = await prisma.workspace.create({
    data: { name: 'test', users: { create: { userId: user.id, role: 'admin' } } },
    select: { id: true },
  })

  return {
    app,
    prisma,
    workspaceId: workspace.id,
    userId: user.id,
    close: async () => {
      // The one piece of raw SQL here, and it is teardown rather than schema
      // definition: dropping a namespace has no equivalent in the model API.
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await dispose()
    },
  }
}
