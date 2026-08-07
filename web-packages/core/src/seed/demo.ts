import 'dotenv/config'
import type { ConversationEvent } from '@idea/shared'
import type { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
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
  member: { username: 'admin', password: 'admin@2026', name: '演示成员' },
  app: {
    slug: 'leave-request',
    name: '请假申请',
    description: '演示用：一个还没开始澄清需求的应用',
  },
}

const DEMO_CONVERSATION_COUNT = 24
const SIX_HOURS = 6 * 60 * 60 * 1000

const demoConversations = Array.from({ length: DEMO_CONVERSATION_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    index,
    title: `分页演示会话 ${number}`,
    userText: `这是第 ${number} 条分页演示会话。`,
    agentText: `已记录第 ${number} 条演示内容。`,
  }
})

const eventRows = (number: number, userText: string, agentText: string, createdAt: Date) => {
  const events = [
    { type: 'user_message', text: userText },
    {
      type: 'item.completed',
      item: {
        id: `demo-answer-${number}`,
        type: 'agent_message',
        status: 'completed',
        text: agentText,
      },
    },
    { type: 'turn.completed' },
  ] satisfies ConversationEvent[]

  return events.map((event, sequence) => ({
    sequence,
    type: event.type,
    payload: event as unknown as Prisma.InputJsonValue,
    createdAt,
  }))
}

const [prisma, disconnect] = createPrisma(url)
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    const provider = await tx.provider.findUnique({ where: { name: 'glm' }, select: { id: true } })
    if (!provider) throw new Error('seed:providers must run before seed:demo')

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

    const existingApp = await tx.app.findFirst({
      where: { workspaceId: ws.id, slug: DEMO.app.slug },
    })
    const app =
      existingApp ??
      (await tx.app.create({
        data: {
          workspaceId: ws.id,
          slug: DEMO.app.slug,
          name: DEMO.app.name,
          description: DEMO.app.description,
          createdById: member.id,
        },
      }))
    if (!existingApp) {
      done.push(`created app "${DEMO.app.name}"`)
    }

    const existingTitles = new Set(
      (
        await tx.conversation.findMany({
          where: {
            appId: app.id,
            titleLocked: true,
            title: { in: demoConversations.map(item => item.title) },
          },
          select: { title: true },
        })
      ).flatMap(row => (row.title ? [row.title] : [])),
    )
    const missing = demoConversations.filter(item => !existingTitles.has(item.title))
    const now = Date.now()

    await Promise.all(
      missing.map(item => {
        const lastActiveAt = new Date(now - item.index * SIX_HOURS)
        return tx.conversation.create({
          data: {
            cid: nanoid(12),
            appId: app.id,
            createdById: member.id,
            providerId: provider.id,
            title: item.title,
            titleLocked: true,
            createdAt: lastActiveAt,
            lastActiveAt,
            events: {
              create: eventRows(item.index + 1, item.userText, item.agentText, lastActiveAt),
            },
          },
        })
      }),
    )
    done.push(
      missing.length > 0
        ? `created ${missing.length} demo conversations`
        : 'demo conversations already exist',
    )
  })

  for (const line of done) console.log(`  ${line}`)
} finally {
  await disconnect()
}
