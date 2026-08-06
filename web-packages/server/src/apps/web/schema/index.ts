import { z } from 'zod'
import { normalizePhone, normalizeUsername } from '../../../identity.ts'

// Request schemas for the web surface. Normalization happens here, at the edge,
// so everything downstream works with canonical values — a username that
// reached a service still mixed-case would defeat the unique constraint.

// Zod refinements that run the shared normalizers, so the browser and the server
// enforce one set of rules rather than two that drift.
const username = z.string().transform((raw, ctx) => {
  const result = normalizeUsername(raw)
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: `invalid username: ${result.error}` })
    return z.NEVER
  }
  return result.value
})

const phone = z.string().transform((raw, ctx) => {
  const result = normalizePhone(raw)
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: `invalid phone: ${result.error}` })
    return z.NEVER
  }
  return result.value
})

// Long enough to be worth hashing, capped because scrypt cost scales with input
// and an unbounded password field is a cheap way to burn server CPU.
const password = z.string().min(8).max(200)

export const LoginBody = z.object({
  // Not normalized: an unknown username must fail identically to a wrong
  // password, and rejecting malformed input here would leak the difference.
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
})

// Both optional, at least one required. Workspace and language are both "what
// I have currently selected", so they patch the same resource rather than each
// getting an endpoint of its own.
export const UpdateSessionBody = z
  .object({
    workspaceId: z.coerce.number().int().positive().optional(),
    locale: z.enum(['zh', 'en']).optional(),
  })
  .refine(v => v.workspaceId !== undefined || v.locale !== undefined, {
    message: 'nothing to update',
  })

export const AcceptInviteBody = z.object({
  username,
  password,
  name: z.string().trim().min(1).max(64),
  phone: phone.nullish(),
})

export const CreateWorkspaceBody = z.object({
  name: z.string().trim().min(1).max(64),
})

export const CreateInviteBody = z.object({
  role: z.enum(['admin', 'member']).default('member'),
})

export const SetRoleBody = z.object({
  role: z.enum(['admin', 'member']),
})

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const CreateAppBody = z.object({
  name: z.string().trim().min(1).max(64),
  slug,
  description: z.string().trim().max(2000).nullish(),
})

export const UpdateAppBody = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    slug: slug.optional(),
    description: z.string().trim().max(2000).nullish(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
  })
  // An empty PATCH is a caller mistake, not a no-op worth pretending succeeded.
  .refine(v => Object.keys(v).length > 0, { message: 'no fields to update' })

const ConversationMessageBody = z
  .object({
    text: z.string().trim().max(20_000).default(''),
    attachmentFids: z.array(z.string().trim().min(1).max(64)).max(10).default([]),
  })
  .refine(({ text, attachmentFids }) => text.length > 0 || attachmentFids.length > 0, {
    message: 'a message needs text or an attachment',
  })

export const StartConversationBody = ConversationMessageBody.and(
  z.object({ workerId: z.number().int().positive() }),
)
export const SendMessageBody = ConversationMessageBody

export const AssignConversationWorkerBody = z.object({
  workerId: z.number().int().positive(),
})

export const CreateFileBody = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  size: z.number().int().positive(),
})
