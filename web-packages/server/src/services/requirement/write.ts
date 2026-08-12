import type { Prisma } from '@idea/core'
import { requirementIsWritable } from '../../domains/requirement.ts'
import type { Service } from '../../types.ts'
import { resolveRequirementFiles } from './files.ts'
import type { RequirementCommandResult, RequirementCommands } from './types.ts'

type Transaction = Prisma.TransactionClient

const conversationId = async (
  tx: Transaction,
  appId: number,
  cid: string | undefined,
): Promise<number | null | undefined> => {
  if (cid === undefined) return undefined
  const conversation = await tx.conversation.findFirst({
    where: { appId, cid },
    select: { id: true },
  })
  return conversation?.id ?? null
}

const hasPrismaCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code

export const createRequirementCommands: Service<RequirementCommands> = app => ({
  create: input =>
    app.$prisma.$transaction(async tx => {
      const files = await resolveRequirementFiles(
        tx,
        input.appId,
        input.imageFids ?? [],
        input.attachmentFids ?? [],
      )
      if (files.kind !== 'ok') return files

      const source = await conversationId(tx, input.appId, input.conversationCid)
      if (source === null) return { kind: 'conversation_not_found' }

      let sequence: number
      try {
        const updated = await tx.app.update({
          where: { id: input.appId, workspaceId: input.workspaceId },
          data: { requirementSequence: { increment: 1 } },
          select: { requirementSequence: true },
        })
        sequence = updated.requirementSequence
      } catch (error) {
        if (hasPrismaCode(error, 'P2025')) return { kind: 'not_found' }
        throw error
      }

      const requirement = await tx.requirement.create({
        data: {
          appId: input.appId,
          number: sequence,
          createdById: input.createdById,
          draft: {
            create: {
              title: input.title,
              summary: input.summary,
              body: input.body,
              updatedById: input.createdById,
              updatedInConversationId: source,
              files: { create: [...files.references] },
            },
          },
        },
        select: { id: true },
      })
      return { kind: 'ok', requirementId: requirement.id }
    }) satisfies Promise<RequirementCommandResult>,

  saveDraft: input =>
    app.$prisma.$transaction(async tx => {
      const requirement = await tx.requirement.findFirst({
        where: {
          id: input.requirementId,
          appId: input.appId,
          app: { workspaceId: input.workspaceId },
        },
        select: {
          id: true,
          status: true,
          draft: { select: { updatedInConversationId: true } },
        },
      })
      if (!requirement) return { kind: 'not_found' }
      if (!requirementIsWritable(requirement.status)) return { kind: 'archived' }

      const source = await conversationId(tx, input.appId, input.conversationCid)
      if (source === null) return { kind: 'conversation_not_found' }
      const files = await resolveRequirementFiles(
        tx,
        input.appId,
        input.imageFids ?? [],
        input.attachmentFids ?? [],
      )
      if (files.kind !== 'ok') return files
      const updatedInConversationId =
        source === undefined ? requirement.draft?.updatedInConversationId : source

      const content = {
        title: input.title,
        summary: input.summary,
        body: input.body,
        updatedById: input.updatedById,
        updatedInConversationId: updatedInConversationId ?? null,
      }
      await tx.requirementDraft.upsert({
        where: { requirementId: requirement.id },
        update: { ...content, version: { increment: 1 } },
        create: { requirementId: requirement.id, ...content },
      })
      await tx.requirementDraftFile.deleteMany({ where: { requirementId: requirement.id } })
      if (files.references.length > 0) {
        await tx.requirementDraftFile.createMany({
          data: files.references.map(reference => ({
            requirementId: requirement.id,
            ...reference,
          })),
        })
      }
      await tx.requirement.update({
        where: { id: requirement.id },
        data: { updatedAt: new Date() },
      })
      return { kind: 'ok', requirementId: requirement.id }
    }) satisfies Promise<RequirementCommandResult>,

  confirm: input =>
    app.$prisma.$transaction(async tx => {
      const requirement = await tx.requirement.findFirst({
        where: {
          id: input.requirementId,
          appId: input.appId,
          app: { workspaceId: input.workspaceId },
        },
        select: {
          id: true,
          status: true,
          draft: { include: { files: { orderBy: { position: 'asc' } } } },
        },
      })
      if (!requirement) return { kind: 'not_found' }
      if (!requirementIsWritable(requirement.status)) return { kind: 'archived' }
      if (!requirement.draft) return { kind: 'draft_missing' }
      if (requirement.draft.version !== input.expectedDraftVersion) {
        return { kind: 'draft_version_conflict' }
      }

      const requestedSource = await conversationId(tx, input.appId, input.conversationCid)
      if (requestedSource === null) return { kind: 'conversation_not_found' }
      const confirmedInConversationId = requestedSource ?? requirement.draft.updatedInConversationId

      const deleted = await tx.requirementDraft.deleteMany({
        where: { requirementId: requirement.id, version: input.expectedDraftVersion },
      })
      if (deleted.count === 0) return { kind: 'draft_version_conflict' }

      const numbered = await tx.requirement.update({
        where: { id: requirement.id },
        data: { revisionSequence: { increment: 1 } },
        select: { revisionSequence: true },
      })
      const revision = await tx.requirementRevision.create({
        data: {
          requirementId: requirement.id,
          number: numbered.revisionSequence,
          title: requirement.draft.title,
          summary: requirement.draft.summary,
          body: requirement.draft.body,
          confirmedById: input.confirmedById,
          confirmedInConversationId,
          files: {
            create: requirement.draft.files.map(({ fileId, role, position }) => ({
              fileId,
              role,
              position,
            })),
          },
        },
        select: { id: true },
      })
      await tx.requirement.update({
        where: { id: requirement.id },
        data: { currentRevisionId: revision.id, status: 'active' },
      })
      return { kind: 'ok', requirementId: requirement.id }
    }) satisfies Promise<RequirementCommandResult>,
})
