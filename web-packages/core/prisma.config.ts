import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 moves the connection url out of the schema and into this file; the
// runtime PrismaClient gets a driver adapter separately (see services/prisma.ts).
//
// The fallback matches docker-compose.yml, and mirrors the one in src/config.ts.
// Prisma's own `env()` helper throws when the variable is absent, which would
// make `prisma generate` — and therefore `pnpm install` — fail on a fresh clone
// that has no .env yet. Generate does not need a reachable database.
// biome-ignore lint/style/noDefaultExport: prisma config requires a default export
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://idea:idea@localhost:5432/idea?schema=public',
  },
})
