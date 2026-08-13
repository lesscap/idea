import 'dotenv/config'
import { createPrisma } from '../../db.ts'
import { activateDraftApps } from './app-status.ts'
import { ensureSystemProviders } from './providers.ts'
import { ensureSystemWorkspaceApps } from './workspace-apps.ts'

const [prisma, dispose] = createPrisma(process.env.DATABASE_URL ?? '')

try {
  const done = [
    ...(await ensureSystemProviders(prisma)),
    ...(await ensureSystemWorkspaceApps(prisma)),
    ...(await activateDraftApps(prisma)),
  ]
  done.forEach(line => {
    console.log(`  ${line}`)
  })
} finally {
  await dispose()
}
