import type { Service } from '../../types.ts'
import {
  resolveIssueFiles,
  revisionFileData,
  sameIssueFiles,
  type IssueFileReference,
} from './files.ts'
import type { IssueCommandResult, IssueCommands } from './types.ts'

type LabelSnapshot = { readonly id: number; readonly name: string; readonly color: string }

const orderedFiles = (files: readonly IssueFileReference[]): readonly IssueFileReference[] =>
  [...files].sort(
    (left, right) => left.role.localeCompare(right.role) || left.position - right.position,
  )

const labelChanges = (current: readonly LabelSnapshot[], next: readonly LabelSnapshot[]) => {
  const currentById = new Map(current.map(label => [label.id, label]))
  const nextById = new Map(next.map(label => [label.id, label]))
  return {
    removed: current.filter(label => !nextById.has(label.id)),
    added: next.filter(label => !currentById.has(label.id)),
  }
}

export const createIssueUpdateCommand: Service<Pick<IssueCommands, 'update'>> = app => ({
  update: input =>
    app.$prisma.$transaction(async tx => {
      const issue = await tx.issue.findFirst({
        where: {
          appId: input.appId,
          number: input.issueNumber,
          app: { workspaceId: input.workspaceId },
        },
        select: {
          id: true,
          number: true,
          title: true,
          body: true,
          type: true,
          revisionSequence: true,
          updatedAt: true,
          files: {
            select: { fileId: true, role: true, position: true },
            orderBy: [{ role: 'asc' }, { position: 'asc' }],
          },
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
        },
      })
      if (!issue) return { kind: 'not_found' }
      if (issue.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        return { kind: 'update_conflict' }
      }

      const files = await resolveIssueFiles(
        tx,
        input.appId,
        input.imageFids ?? [],
        input.attachmentFids ?? [],
      )
      if (files.kind !== 'ok') return files

      const labelIds = [...new Set(input.labelIds)]
      if (labelIds.length !== input.labelIds.length) return { kind: 'label_not_found' }
      const labels = await tx.label.findMany({
        where: { appId: input.appId, id: { in: labelIds } },
        select: { id: true, name: true, color: true },
      })
      if (labels.length !== labelIds.length) return { kind: 'label_not_found' }

      const nextFiles = orderedFiles(files.references)
      const contentChanged =
        issue.title !== input.title ||
        issue.body !== input.body ||
        !sameIssueFiles(issue.files, nextFiles)
      const typeChanged = issue.type !== input.type
      const changes = labelChanges(
        issue.labels.map(item => item.label),
        labels,
      )
      const labelsChanged = changes.added.length > 0 || changes.removed.length > 0
      if (!contentChanged && !typeChanged && !labelsChanged) {
        return { kind: 'ok', issueNumber: issue.number }
      }

      const nextRevision = contentChanged ? issue.revisionSequence + 1 : issue.revisionSequence
      const updated = await tx.issue.updateMany({
        where: { id: issue.id, updatedAt: issue.updatedAt },
        data: {
          title: input.title,
          body: input.body,
          type: input.type,
          revisionSequence: nextRevision,
          updatedById: input.updatedById,
        },
      })
      if (updated.count === 0) return { kind: 'update_conflict' }

      if (contentChanged) {
        await tx.issueFile.deleteMany({ where: { issueId: issue.id } })
        if (files.references.length > 0) {
          await tx.issueFile.createMany({
            data: files.references.map(reference => ({ issueId: issue.id, ...reference })),
          })
        }
        await tx.issueRevision.create({
          data: {
            issueId: issue.id,
            number: nextRevision,
            title: input.title,
            body: input.body,
            editedById: input.updatedById,
            files: { create: revisionFileData(files.references) },
          },
        })
      }

      if (changes.removed.length > 0) {
        await tx.issueLabel.deleteMany({
          where: { issueId: issue.id, labelId: { in: changes.removed.map(label => label.id) } },
        })
      }
      if (changes.added.length > 0) {
        await tx.issueLabel.createMany({
          data: changes.added.map(label => ({ issueId: issue.id, labelId: label.id })),
        })
      }
      if (typeChanged || labelsChanged) {
        await tx.issueActivity.createMany({
          data: [
            ...(typeChanged
              ? [
                  {
                    issueId: issue.id,
                    kind: 'type_changed' as const,
                    actorId: input.updatedById,
                    fromType: issue.type,
                    toType: input.type,
                  },
                ]
              : []),
            ...changes.removed.map(label => ({
              issueId: issue.id,
              kind: 'label_removed' as const,
              actorId: input.updatedById,
              labelId: label.id,
              labelName: label.name,
              labelColor: label.color,
            })),
            ...changes.added.map(label => ({
              issueId: issue.id,
              kind: 'label_added' as const,
              actorId: input.updatedById,
              labelId: label.id,
              labelName: label.name,
              labelColor: label.color,
            })),
          ],
        })
      }
      return { kind: 'ok', issueNumber: issue.number }
    }) satisfies Promise<IssueCommandResult>,
})
