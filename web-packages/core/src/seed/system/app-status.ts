import type { PrismaClient } from '@prisma/client'

export const activateDraftApps = async (prisma: PrismaClient): Promise<string[]> => {
  const activated = await prisma.app.updateMany({
    where: { status: 'draft' },
    data: { status: 'active' },
  })

  return [`app status: ${activated.count} draft apps activated`]
}
