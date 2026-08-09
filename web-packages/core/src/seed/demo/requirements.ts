import 'dotenv/config'
import type { Prisma } from '@prisma/client'
import { createPrisma } from '../../db.ts'
import { DEMO, ensureDemoContext } from './context.ts'
import { requireDemoDatabaseUrl } from './guard.ts'
import {
  DEMO_REQUIREMENTS,
  type DemoRequirement,
  type DemoRequirementContent,
} from './requirement-data.ts'

// Development-only requirement fixtures. This command is intentionally
// independent from seed:demo so UI work can request just the data it needs.
//
//   pnpm --filter @idea/core seed:demo:requirements

const existingInclude = {
  draft: true,
  revisions: { orderBy: { number: 'asc' as const } },
  currentRevision: { select: { number: true, title: true } },
} as const satisfies Prisma.RequirementInclude

type ExistingRequirement = Prisma.RequirementGetPayload<{ include: typeof existingInclude }>

const contentMatches = (
  actual: Pick<DemoRequirementContent, 'title' | 'summary' | 'body'>,
  expected: DemoRequirementContent,
): boolean =>
  actual.title === expected.title &&
  actual.summary === expected.summary &&
  actual.body === expected.body

const requirementMatches = (actual: ExistingRequirement, expected: DemoRequirement): boolean => {
  const draftMatches = expected.draft
    ? actual.draft !== null &&
      actual.draft.version === expected.draft.version &&
      contentMatches(actual.draft, expected.draft)
    : actual.draft === null
  const revisionsMatch =
    actual.revisions.length === expected.revisions.length &&
    actual.revisions.every((revision, index) => {
      const expectedRevision = expected.revisions[index]
      return (
        expectedRevision !== undefined &&
        revision.number === expectedRevision.number &&
        contentMatches(revision, expectedRevision)
      )
    })

  return (
    actual.status === expected.status &&
    actual.revisionSequence === expected.revisionSequence &&
    (actual.currentRevision?.number ?? null) === expected.currentRevisionNumber &&
    draftMatches &&
    revisionsMatch
  )
}

const expectedTitle = (requirement: DemoRequirement): string =>
  requirement.draft?.title ??
  requirement.revisions.find(item => item.number === requirement.currentRevisionNumber)?.title ??
  ''

const [prisma, disconnect] = createPrisma(requireDemoDatabaseUrl())
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    const context = await ensureDemoContext(tx, done)
    const existing = await tx.requirement.findMany({
      where: {
        appId: context.appId,
        number: { in: DEMO_REQUIREMENTS.map(requirement => requirement.number) },
      },
      include: existingInclude,
    })
    const existingByNumber = new Map(existing.map(requirement => [requirement.number, requirement]))
    const conflicts = DEMO_REQUIREMENTS.flatMap(requirement => {
      const found = existingByNumber.get(requirement.number)
      const foundTitle = found?.draft?.title ?? found?.currentRevision?.title ?? '(untitled)'
      return found && !requirementMatches(found, requirement)
        ? [
            `${DEMO.app.name} R-${requirement.number}: expected "${expectedTitle(requirement)}", found "${foundTitle}" (id ${found.id})`,
          ]
        : []
    })
    if (conflicts.length > 0) {
      throw new Error(`demo requirement slots contain non-seed data:\n${conflicts.join('\n')}`)
    }

    const missing = DEMO_REQUIREMENTS.filter(
      requirement => !existingByNumber.has(requirement.number),
    )
    const now = Date.now()
    const sixHours = 6 * 60 * 60 * 1000
    const day = 24 * 60 * 60 * 1000

    for (const requirement of missing) {
      const updatedAt = new Date(now - (requirement.number - 1) * sixHours)
      const created = await tx.requirement.create({
        data: {
          appId: context.appId,
          number: requirement.number,
          status: requirement.status,
          revisionSequence: requirement.revisionSequence,
          createdById: context.userId,
          createdAt: updatedAt,
          updatedAt,
          draft: requirement.draft
            ? {
                create: {
                  title: requirement.draft.title,
                  summary: requirement.draft.summary,
                  body: requirement.draft.body,
                  version: requirement.draft.version,
                  updatedById: context.userId,
                  createdAt: updatedAt,
                  updatedAt,
                },
              }
            : undefined,
        },
        select: { id: true },
      })

      const revisionIds = new Map<number, number>()
      for (const revision of requirement.revisions) {
        const createdRevision = await tx.requirementRevision.create({
          data: {
            requirementId: created.id,
            number: revision.number,
            title: revision.title,
            summary: revision.summary,
            body: revision.body,
            confirmedById: context.userId,
            confirmedAt: new Date(
              updatedAt.getTime() - (requirement.revisionSequence - revision.number) * day,
            ),
          },
          select: { id: true },
        })
        revisionIds.set(revision.number, createdRevision.id)
      }

      if (requirement.currentRevisionNumber !== null) {
        const currentRevisionId = revisionIds.get(requirement.currentRevisionNumber)
        if (!currentRevisionId) {
          throw new Error(`R-${requirement.number} current revision is missing from its manifest`)
        }
        await tx.requirement.update({
          where: { id: created.id },
          data: { currentRevisionId, updatedAt },
        })
      }
    }

    if (context.requirementSequence < DEMO_REQUIREMENTS.length) {
      await tx.app.update({
        where: { id: context.appId },
        data: { requirementSequence: DEMO_REQUIREMENTS.length },
      })
    }
    done.push(
      missing.length > 0
        ? `created ${missing.length} demo requirements`
        : 'demo requirements already exist',
    )
  })

  done.forEach(line => {
    console.log(`  ${line}`)
  })
} finally {
  await disconnect()
}
