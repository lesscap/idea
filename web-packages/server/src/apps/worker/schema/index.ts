import { z } from 'zod'

// Request schemas for the worker surface. Separate from the web ones because the
// two surfaces share no validation and no auth — the split is what keeps a
// worker route from drifting into cookie-shaped assumptions.

export const RegisterWorkerBody = z.object({
  // Stable per machine. This is the identity anchor: the same value returns the
  // same worker row rather than creating another.
  machineId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(64),
  hostname: z.string().trim().min(1).max(255),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(32).default([]),
})

export const ClaimTurnParams = z.object({
  id: z.coerce.number().int().positive(),
})

// The payload is a canonical ConversationEvent, whose full shape lives in
// @idea/shared as a TypeScript union. Only the discriminator is checked here:
// re-encoding every variant as a schema would be a second definition to keep in
// step, and the worker producing these is our own code, not an untrusted client.
export const AppendEventBody = z.object({ type: z.string().min(1) }).passthrough()

export const FinishTurnBody = z.object({
  outcome: z.enum(['completed', 'failed', 'aborted']),
})
