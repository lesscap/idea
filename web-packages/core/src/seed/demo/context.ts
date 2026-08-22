import type { Prisma } from '@prisma/client'
import { hashPassword } from '../../crypto.ts'
import { ensureWorkspaceSystemApp } from '../../system-app.ts'

export const DEMO = {
  workspace: '演示空间',
  member: { username: 'admin', password: 'admin@2026', name: '演示成员' },
  app: {
    slug: 'leave-request',
    name: '请假申请',
    description: '演示用：一个还没开始澄清需求的应用',
  },
} as const

export type DemoContext = {
  readonly workspaceId: number
  readonly userId: number
  readonly appId: number
  readonly issueSequence: number
}

export const ensureDemoContext = async (
  tx: Prisma.TransactionClient,
  done: string[],
): Promise<DemoContext> => {
  const workspace =
    (await tx.workspace.findFirst({ where: { name: DEMO.workspace } })) ??
    (await tx.workspace.create({ data: { name: DEMO.workspace } }))
  done.push(`workspace "${workspace.name}" (id ${workspace.id})`)

  let member = await tx.user.findUnique({ where: { username: DEMO.member.username } })
  if (!member) {
    member = await tx.user.create({
      data: {
        username: DEMO.member.username,
        name: DEMO.member.name,
        passwordHash: hashPassword(DEMO.member.password),
      },
    })
    done.push(`created member "${DEMO.member.username}" / ${DEMO.member.password}`)
  } else {
    done.push(`member "${DEMO.member.username}" already exists`)
  }

  const membership = await tx.userWorkspace.findUnique({
    where: { userId_workspaceId: { userId: member.id, workspaceId: workspace.id } },
  })
  if (!membership) {
    await tx.userWorkspace.create({
      data: { userId: member.id, workspaceId: workspace.id, role: 'member' },
    })
    done.push('joined demo workspace as member')
  }

  await ensureWorkspaceSystemApp(tx, workspace.id, member.id)

  const existingApp = await tx.app.findFirst({
    where: { workspaceId: workspace.id, slug: DEMO.app.slug },
  })
  const app =
    existingApp ??
    (await tx.app.create({
      data: {
        workspaceId: workspace.id,
        slug: DEMO.app.slug,
        name: DEMO.app.name,
        description: DEMO.app.description,
        createdById: member.id,
      },
    }))
  if (!existingApp) done.push(`created app "${DEMO.app.name}"`)

  return {
    workspaceId: workspace.id,
    userId: member.id,
    appId: app.id,
    issueSequence: app.issueSequence,
  }
}
