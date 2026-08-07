import { z } from 'zod'

const title = z.string().trim().min(1).max(200)
const summary = z.string().trim().max(2_000)
const body = z.string().max(100_000)
const conversationCid = z.string().trim().min(1).max(64).optional()

export const CreateRequirementBody = z.object({
  title,
  summary: summary.default(''),
  body: body.default(''),
  conversationCid,
})

export const SaveRequirementDraftBody = z.object({
  title,
  summary,
  body,
  conversationCid,
})

export const ConfirmRequirementBody = z.object({
  expectedDraftVersion: z.number().int().positive(),
  conversationCid,
})
