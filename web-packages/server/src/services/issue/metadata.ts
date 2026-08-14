import type { Prisma } from '@idea/core'
import type { Service } from '../../types.ts'
import type {
  CloseIssueInput,
  IssueCommandResult,
  IssueCommands,
  ReopenIssueInput,
  SetIssueLabelsInput,
  SetIssueTypeInput,
} from './types.ts'

type Transaction = Prisma.TransactionClient

const findIssue = (
  tx: Transaction,
  input: { workspaceId: number; appId: number; issueNumber: number },
) =>
  tx.issue.findFirst({
    where: {
      appId: input.appId,
      number: input.issueNumber,
      app: { workspaceId: input.workspaceId },
    },
    select: { id: true, number: true, state: true, closeReason: true, type: true },
  })

const setType = async (tx: Transaction, input: SetIssueTypeInput): Promise<IssueCommandResult> => {
  const issue = await findIssue(tx, input)
  if (!issue) return { kind: 'not_found' }
  if (issue.type === input.type) return { kind: 'ok', issueNumber: issue.number }
  await tx.issue.update({
    where: { id: issue.id },
    data: {
      type: input.type,
      updatedById: input.actorId,
      activities: {
        create: {
          kind: 'type_changed',
          actorId: input.actorId,
          fromType: issue.type,
          toType: input.type,
        },
      },
    },
  })
  return { kind: 'ok', issueNumber: issue.number }
}

const setLabels = async (
  tx: Transaction,
  input: SetIssueLabelsInput,
): Promise<IssueCommandResult> => {
  const issue = await tx.issue.findFirst({
    where: {
      appId: input.appId,
      number: input.issueNumber,
      app: { workspaceId: input.workspaceId },
    },
    select: {
      id: true,
      number: true,
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
    },
  })
  if (!issue) return { kind: 'not_found' }

  const nextIds = [...new Set(input.labelIds)]
  if (nextIds.length !== input.labelIds.length) return { kind: 'label_not_found' }
  const nextLabels = await tx.label.findMany({
    where: { appId: input.appId, id: { in: nextIds } },
    select: { id: true, name: true, color: true },
  })
  if (nextLabels.length !== nextIds.length) return { kind: 'label_not_found' }

  const current = new Map(issue.labels.map(item => [item.label.id, item.label]))
  const next = new Map(nextLabels.map(label => [label.id, label]))
  const removed = [...current.values()].filter(label => !next.has(label.id))
  const added = [...next.values()].filter(label => !current.has(label.id))
  if (removed.length === 0 && added.length === 0) {
    return { kind: 'ok', issueNumber: issue.number }
  }

  if (removed.length > 0) {
    await tx.issueLabel.deleteMany({
      where: { issueId: issue.id, labelId: { in: removed.map(label => label.id) } },
    })
  }
  if (added.length > 0) {
    await tx.issueLabel.createMany({
      data: added.map(label => ({ issueId: issue.id, labelId: label.id })),
    })
  }
  await tx.issueActivity.createMany({
    data: [
      ...removed.map(label => ({
        issueId: issue.id,
        kind: 'label_removed' as const,
        actorId: input.actorId,
        labelId: label.id,
        labelName: label.name,
        labelColor: label.color,
      })),
      ...added.map(label => ({
        issueId: issue.id,
        kind: 'label_added' as const,
        actorId: input.actorId,
        labelId: label.id,
        labelName: label.name,
        labelColor: label.color,
      })),
    ],
  })
  await tx.issue.update({ where: { id: issue.id }, data: { updatedById: input.actorId } })
  return { kind: 'ok', issueNumber: issue.number }
}

const close = async (tx: Transaction, input: CloseIssueInput): Promise<IssueCommandResult> => {
  const issue = await findIssue(tx, input)
  if (!issue) return { kind: 'not_found' }
  if (issue.state === 'closed') return { kind: 'ok', issueNumber: issue.number }

  await tx.issue.update({
    where: { id: issue.id },
    data: {
      state: 'closed',
      closeReason: input.closeReason,
      closedAt: new Date(),
      closedById: input.actorId,
      updatedById: input.actorId,
      activities: {
        create: {
          kind: 'state_changed',
          actorId: input.actorId,
          fromState: issue.state,
          toState: 'closed',
          closeReason: input.closeReason,
        },
      },
    },
  })
  return { kind: 'ok', issueNumber: issue.number }
}

const reopen = async (tx: Transaction, input: ReopenIssueInput): Promise<IssueCommandResult> => {
  const issue = await findIssue(tx, input)
  if (!issue) return { kind: 'not_found' }
  if (issue.state === 'open') return { kind: 'ok', issueNumber: issue.number }
  await tx.issue.update({
    where: { id: issue.id },
    data: {
      state: 'open',
      closeReason: null,
      closedAt: null,
      closedById: null,
      updatedById: input.actorId,
      activities: {
        create: {
          kind: 'state_changed',
          actorId: input.actorId,
          fromState: issue.state,
          toState: 'open',
        },
      },
    },
  })
  return { kind: 'ok', issueNumber: issue.number }
}

export const createIssueMetadataCommands: Service<
  Pick<IssueCommands, 'setType' | 'setLabels' | 'close' | 'reopen'>
> = app => ({
  setType: input => app.$prisma.$transaction(tx => setType(tx, input)),
  setLabels: input => app.$prisma.$transaction(tx => setLabels(tx, input)),
  close: input => app.$prisma.$transaction(tx => close(tx, input)),
  reopen: input => app.$prisma.$transaction(tx => reopen(tx, input)),
})
