import 'dotenv/config'
import { createPrisma } from '../../db.ts'
import { DEMO, ensureDemoContext } from './context.ts'
import { requireDemoDatabaseUrl } from './guard.ts'
import { DEMO_ISSUES, DEMO_LABELS } from './issue-data.ts'

const [prisma, disconnect] = createPrisma(requireDemoDatabaseUrl())
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    const context = await ensureDemoContext(tx, done)
    const labels = await Promise.all(
      DEMO_LABELS.map(label =>
        tx.label.upsert({
          where: {
            appId_normalizedName: {
              appId: context.appId,
              normalizedName: label.name.toLocaleLowerCase(),
            },
          },
          create: {
            appId: context.appId,
            normalizedName: label.name.toLocaleLowerCase(),
            ...label,
          },
          update: { description: label.description, color: label.color },
        }),
      ),
    )
    const labelsByName = new Map(labels.map(label => [label.name, label.id]))
    const existing = await tx.issue.findMany({
      where: { appId: context.appId, number: { in: DEMO_ISSUES.map(item => item.number) } },
      select: { number: true, title: true },
    })
    const existingByNumber = new Map(existing.map(item => [item.number, item]))
    const conflicts = DEMO_ISSUES.flatMap(item => {
      const found = existingByNumber.get(item.number)
      return found && found.title !== item.title
        ? [`${DEMO.app.name} #${item.number}: expected "${item.title}", found "${found.title}"`]
        : []
    })
    if (conflicts.length > 0)
      throw new Error(`demo issue slots contain non-seed data:\n${conflicts.join('\n')}`)

    const missing = DEMO_ISSUES.filter(item => !existingByNumber.has(item.number))
    const now = Date.now()
    const sixHours = 6 * 60 * 60 * 1000
    await Promise.all(
      missing.map(item => {
        const timestamp = new Date(now - (item.number - 1) * sixHours)
        const labelIds = item.labels.map(name => {
          const labelId = labelsByName.get(name)
          if (!labelId) throw new Error(`demo label ${name} is missing`)
          return labelId
        })
        return tx.issue.create({
          data: {
            appId: context.appId,
            number: item.number,
            title: item.title,
            body: item.body,
            type: item.type,
            state: item.state,
            closeReason: item.closeReason,
            createdById: context.userId,
            updatedById: context.userId,
            closedById: item.state === 'closed' ? context.userId : null,
            closedAt: item.state === 'closed' ? timestamp : null,
            createdAt: timestamp,
            updatedAt: timestamp,
            labels: { create: labelIds.map(labelId => ({ labelId })) },
            revisions: {
              create: {
                number: 1,
                title: item.title,
                body: item.body,
                editedById: context.userId,
                createdAt: timestamp,
              },
            },
          },
        })
      }),
    )
    if (context.issueSequence < DEMO_ISSUES.length) {
      await tx.app.update({
        where: { id: context.appId },
        data: { issueSequence: DEMO_ISSUES.length },
      })
    }
    done.push(
      missing.length > 0 ? `created ${missing.length} demo issues` : 'demo issues already exist',
    )
  })

  done.forEach(line => {
    console.log(`  ${line}`)
  })
} finally {
  await disconnect()
}
