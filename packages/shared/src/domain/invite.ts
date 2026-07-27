import type { Role } from './workspace.ts'

// What someone holding an invite link is shown before deciding to accept.
//
// Carries no identity, because the invite has none — the admin who generated it
// did not know who would use it. It only says which workspace, at what role, and
// who opened the door.
export type InvitePreview = {
  readonly workspaceName: string
  readonly role: Role
  readonly invitedByName: string
  readonly expiresAt: string
}

// Returned once, at creation, and never again: only the SHA-256 digest is
// stored. The UI has to make clear that closing the dialog loses the link.
export type CreatedInvite = {
  readonly token: string
  readonly expiresAt: string
}
