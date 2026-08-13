import type { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'

type SystemAppClient = Pick<Prisma.TransactionClient, 'app' | 'workspace'>

export type SystemAppIdentity = {
  readonly id: number
  readonly workspaceId: number
}

export const ensureWorkspaceSystemApp = async (
  tx: SystemAppClient,
  workspaceId: number,
  createdById: number,
): Promise<SystemAppIdentity> => {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { systemApp: { select: { id: true, workspaceId: true } } },
  })
  if (!workspace) throw new Error(`workspace ${workspaceId} not found`)
  if (workspace.systemApp) return workspace.systemApp

  const suffix = nanoid(12)
  const systemApp = await tx.app.create({
    data: {
      workspaceId,
      slug: `__workspace-${suffix}`,
      name: `__workspace-${suffix}`,
      description: null,
      createdById,
    },
    select: { id: true, workspaceId: true },
  })
  await tx.workspace.update({ where: { id: workspaceId }, data: { systemAppId: systemApp.id } })
  return systemApp
}
