import type { Prisma } from '@idea/core'
import type { Service } from '../../types.ts'
import { resolveIssueFiles, revisionFileData } from './files.ts'
import type { IssueCommandResult, IssueCommands } from './types.ts'

type Transaction = Prisma.TransactionClient

const hasPrismaCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code

const validateLabels = async (
  tx: Transaction,
  appId: number,
  labelIds: readonly number[],
): Promise<boolean> => {
  const uniqueIds = [...new Set(labelIds)]
  if (uniqueIds.length !== labelIds.length) return false
  if (uniqueIds.length === 0) return true
  return (await tx.label.count({ where: { appId, id: { in: uniqueIds } } })) === uniqueIds.length
}

export const createIssueCommands: Service<Pick<IssueCommands, 'create'>> = app => ({
  create: input =>
    app.$prisma.$transaction(async tx => {
      const files = await resolveIssueFiles(
        tx,
        input.appId,
        input.imageFids ?? [],
        input.attachmentFids ?? [],
      )
      if (files.kind !== 'ok') return files
      if (!(await validateLabels(tx, input.appId, input.labelIds ?? []))) {
        return { kind: 'label_not_found' }
      }

      let sequence: number
      try {
        const updated = await tx.app.update({
          where: { id: input.appId, workspaceId: input.workspaceId },
          data: { issueSequence: { increment: 1 } },
          select: { issueSequence: true },
        })
        sequence = updated.issueSequence
      } catch (error) {
        if (hasPrismaCode(error, 'P2025')) return { kind: 'not_found' }
        throw error
      }

      await tx.issue.create({
        data: {
          appId: input.appId,
          number: sequence,
          title: input.title,
          body: input.body,
          type: input.type,
          createdById: input.createdById,
          updatedById: input.createdById,
          files: { create: revisionFileData(files.references) },
          labels: {
            create: (input.labelIds ?? []).map(labelId => ({ labelId })),
          },
          revisions: {
            create: {
              number: 1,
              title: input.title,
              body: input.body,
              editedById: input.createdById,
              files: { create: revisionFileData(files.references) },
            },
          },
        },
      })
      return { kind: 'ok', issueNumber: sequence }
    }) satisfies Promise<IssueCommandResult>,

})
