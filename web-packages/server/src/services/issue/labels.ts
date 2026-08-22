import type { IssueLabel } from '@idea/shared'
import type { Service } from '../../types.ts'
import type {
  CreateLabelInput,
  DeleteLabelInput,
  DeleteLabelResult,
  LabelWriteResult,
  UpdateLabelInput,
} from './types.ts'

const labelSelect = { id: true, name: true, description: true, color: true } as const

const hasPrismaCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code

const normalizeName = (name: string): string => name.trim().toLocaleLowerCase()
const toLabel = (label: IssueLabel): IssueLabel => ({ ...label })

export type IssueLabelCommands = {
  readonly create: (input: CreateLabelInput) => Promise<LabelWriteResult>
  readonly update: (input: UpdateLabelInput) => Promise<LabelWriteResult>
  readonly delete: (input: DeleteLabelInput) => Promise<DeleteLabelResult>
}

export const createIssueLabelCommands: Service<IssueLabelCommands> = app => ({
  create: async input => {
    try {
      const appExists = await app.$prisma.app.count({
        where: { id: input.appId, workspaceId: input.workspaceId },
      })
      if (appExists === 0) return { kind: 'not_found' }
      const label = await app.$prisma.label.create({
        data: {
          appId: input.appId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          description: input.description,
          color: input.color,
        },
        select: labelSelect,
      })
      return { kind: 'ok', label: toLabel(label) }
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) return { kind: 'label_name_taken' }
      if (hasPrismaCode(error, 'P2025')) return { kind: 'not_found' }
      throw error
    }
  },
  update: async input => {
    try {
      const updated = await app.$prisma.label.updateMany({
        where: { id: input.labelId, appId: input.appId, app: { workspaceId: input.workspaceId } },
        data: {
          name: input.name,
          normalizedName: normalizeName(input.name),
          description: input.description,
          color: input.color,
        },
      })
      if (updated.count === 0) return { kind: 'not_found' }
      const label = await app.$prisma.label.findUniqueOrThrow({
        where: { id: input.labelId },
        select: labelSelect,
      })
      return { kind: 'ok', label: toLabel(label) }
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) return { kind: 'label_name_taken' }
      throw error
    }
  },
  delete: input =>
    app.$prisma.$transaction(async tx => {
      const label = await tx.label.findFirst({
        where: { id: input.labelId, appId: input.appId, app: { workspaceId: input.workspaceId } },
        select: {
          id: true,
          name: true,
          color: true,
          issues: { select: { issueId: true } },
        },
      })
      if (!label) return { kind: 'not_found' }
      if (label.issues.length > 0) {
        await tx.issueActivity.createMany({
          data: label.issues.map(({ issueId }) => ({
            issueId,
            kind: 'label_removed',
            actorId: input.actorId,
            labelName: label.name,
            labelColor: label.color,
          })),
        })
        await tx.issue.updateMany({
          where: { id: { in: label.issues.map(item => item.issueId) } },
          data: { updatedById: input.actorId },
        })
      }
      await tx.label.delete({ where: { id: label.id } })
      return { kind: 'ok' }
    }),
})
