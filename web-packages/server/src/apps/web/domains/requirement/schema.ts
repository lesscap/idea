import { z } from 'zod'

const title = z.string().trim().min(1).max(200)
const summary = z.string().trim().max(2_000)
const body = z.string().max(100_000)
const conversationCid = z.string().trim().min(1).max(64).optional()
const fileFids = z.array(z.string().trim().min(1).max(64)).max(10).default([])

const contentFiles = {
  imageFids: fileFids,
  attachmentFids: fileFids,
}

const uniqueFiles = <T extends { imageFids: readonly string[]; attachmentFids: readonly string[] }>(
  value: T,
) =>
  new Set([...value.imageFids, ...value.attachmentFids]).size ===
  value.imageFids.length + value.attachmentFids.length

export const CreateRequirementBody = z
  .object({
    title,
    summary: summary.default(''),
    body: body.default(''),
    conversationCid,
    ...contentFiles,
  })
  .refine(uniqueFiles, { message: 'file references must be unique', path: ['attachmentFids'] })

export const SaveRequirementDraftBody = z
  .object({
    title,
    summary,
    body,
    conversationCid,
    ...contentFiles,
  })
  .refine(uniqueFiles, { message: 'file references must be unique', path: ['attachmentFids'] })

export const ConfirmRequirementBody = z.object({
  expectedDraftVersion: z.number().int().positive(),
  conversationCid,
})
