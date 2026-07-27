import type { Id, InvitePreview } from '@idea/shared'
import { get, post } from '../../lib/request.ts'

// Invite endpoints, local to this leaf feature. Both are public — the token in
// the URL is the credential, since the person using it has no account yet.

export type InviteAcceptInput = {
  username: string
  password: string
  name: string
  phone?: string
}

export const previewInvite = (token: string): Promise<InvitePreview> =>
  get<InvitePreview>(`/invites/${encodeURIComponent(token)}`)

// No body means "join as whoever is already signed in"; the registration fields
// mean "create an account and join".
export const acceptInvite = (
  token: string,
  input?: InviteAcceptInput,
): Promise<{ workspaceId: Id }> =>
  post<{ workspaceId: Id }>(`/invites/${encodeURIComponent(token)}/accept`, input ?? {})
