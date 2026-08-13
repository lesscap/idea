import type { PrismaClient } from '@prisma/client'
import { ensureWorkspaceSystemApp } from '../../system-app.ts'

type WorkspaceCandidate = {
  readonly workspaceId: number
  readonly createdById: number
}

export const ensureSystemWorkspaceApps = async (prisma: PrismaClient): Promise<string[]> => {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, systemAppId: true },
    orderBy: { id: 'asc' },
  })
  const missing = workspaces.filter(workspace => workspace.systemAppId === null)
  const candidates = await Promise.all(
    missing.map(async workspace => {
      const admin = await prisma.userWorkspace.findFirst({
        where: { workspaceId: workspace.id, role: 'admin' },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      })
      const member =
        admin ??
        (await prisma.userWorkspace.findFirst({
          where: { workspaceId: workspace.id },
          select: { userId: true },
          orderBy: { createdAt: 'asc' },
        }))
      return member
        ? ({ workspaceId: workspace.id, createdById: member.userId } satisfies WorkspaceCandidate)
        : null
    }),
  )
  const orphaned = missing.filter((_, index) => candidates[index] === null).map(item => item.id)
  if (orphaned.length > 0) {
    throw new Error(
      `workspaces without members cannot receive a system app: ${orphaned.join(', ')}`,
    )
  }

  const ready = candidates.filter((item): item is WorkspaceCandidate => item !== null)
  await prisma.$transaction(async tx => {
    for (const candidate of ready) {
      await ensureWorkspaceSystemApp(tx, candidate.workspaceId, candidate.createdById)
    }
  })

  return [
    `workspace apps: ${ready.length} created, ${workspaces.length - ready.length} already present`,
  ]
}
