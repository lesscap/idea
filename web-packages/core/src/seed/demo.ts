import 'dotenv/config'
import { hashPassword } from '../crypto.ts'
import { createPrisma } from '../db.ts'

// Demonstration data for local work: a second workspace, a plain member, and a
// sample app, so permission differences and workspace switching are visible
// without setting them up by hand every time.
//
// NEVER RUN THIS IN PRODUCTION. It creates accounts with published passwords.
// The guard below is not a formality — a seed script that only *says* it is
// development-only will eventually run somewhere it should not.
//
//   pnpm --filter @idea/core seed:demo
//
// Idempotent, like seed:admin — running it twice changes nothing the second
// time. Existing passwords are left alone for the same reason.

if (process.env.NODE_ENV === 'production') {
  console.error('refusing to run: seed:demo creates accounts with known passwords')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// A production database is not identified by NODE_ENV alone — the check above
// only catches the case where someone remembered to set it.
if (/prod/i.test(url)) {
  console.error(`refusing to run: DATABASE_URL looks like production (${url.split('@').pop()})`)
  process.exit(1)
}

const DEMO = {
  workspace: '演示空间',
  member: { username: 'demo.member', password: 'demo@2026', name: '演示成员' },
  app: { name: '请假申请', description: '演示用：一个还没开始澄清需求的应用' },
}

const [prisma, disconnect] = createPrisma(url)
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    const ws =
      (await tx.workspace.findFirst({ where: { name: DEMO.workspace } })) ??
      (await tx.workspace.create({ data: { name: DEMO.workspace } }))
    done.push(`workspace "${ws.name}" (id ${ws.id})`)

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

    // Deliberately a plain member, not an admin: the point of this account is to
    // make the permission difference visible in the UI.
    const membership = await tx.userWorkspace.findUnique({
      where: { userId_workspaceId: { userId: member.id, workspaceId: ws.id } },
    })
    if (!membership) {
      await tx.userWorkspace.create({
        data: { userId: member.id, workspaceId: ws.id, role: 'member' },
      })
      done.push('joined demo workspace as member')
    }

    const app = await tx.app.findFirst({ where: { workspaceId: ws.id, name: DEMO.app.name } })
    if (!app) {
      await tx.app.create({
        data: {
          workspaceId: ws.id,
          name: DEMO.app.name,
          description: DEMO.app.description,
          createdById: member.id,
        },
      })
      done.push(`created app "${DEMO.app.name}"`)
    }
  })

  for (const line of done) console.log(`  ${line}`)
} finally {
  await disconnect()
}
