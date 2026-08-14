import { z } from 'zod'

const title = z.string().trim().min(1).max(200)
const body = z.string().max(100_000)
const fileFids = z.array(z.string().trim().min(1).max(64)).max(10).default([])
const issueType = z.enum(['bug', 'feature', 'task']).nullable()
const labelIds = z.array(z.number().int().positive()).max(50).default([])
const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length
const uniqueFiles = (value: { imageFids: readonly string[]; attachmentFids: readonly string[] }) =>
  unique([...value.imageFids, ...value.attachmentFids])

const content = {
  title,
  body: body.default(''),
  imageFids: fileFids,
  attachmentFids: fileFids,
}

export const CreateIssueBody = z
  .object({ ...content, type: issueType.default(null), labelIds })
  .refine(uniqueFiles, { message: 'file references must be unique', path: ['attachmentFids'] })
  .refine(value => unique(value.labelIds), {
    message: 'label references must be unique',
    path: ['labelIds'],
  })

export const UpdateIssueBody = z
  .object({
    ...content,
    type: issueType,
    labelIds,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .refine(uniqueFiles, { message: 'file references must be unique', path: ['attachmentFids'] })
  .refine(value => unique(value.labelIds), {
    message: 'label references must be unique',
    path: ['labelIds'],
  })

export const SetIssueTypeBody = z.object({ type: issueType })
export const SetIssueLabelsBody = z.object({ labelIds }).refine(value => unique(value.labelIds), {
  message: 'label references must be unique',
  path: ['labelIds'],
})
export const CloseIssueBody = z.object({ reason: z.enum(['completed', 'not_planned']) })

const labelName = z.string().trim().min(1).max(50)
const labelDescription = z.string().trim().max(100).nullable().default(null)
const labelColor = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{6}$/)
  .transform(value => value.toLowerCase())

export const CreateLabelBody = z.object({
  name: labelName,
  description: labelDescription,
  color: labelColor,
})
export const UpdateLabelBody = CreateLabelBody
