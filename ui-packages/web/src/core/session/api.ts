import type { CurrentUser, Id, Role } from '@idea/shared'
import { del, get, patch, post } from '../../lib/request'

// The session resource: POST creates it, GET reads it, PATCH changes the
// selected workspace, DELETE ends it.
//
// Lives in core because core/session/use-session.ts depends on it. The
// dependency runs store → api → request and never the other way; an api module
// that imported the store could not be exercised without one.

export type SessionState = {
  readonly user: CurrentUser
  readonly workspaceId: Id | null
  readonly role: Role | null
  // Stored server-side, so the choice follows the user between devices. Null
  // means never chosen — the client falls back to the browser's language.
  readonly locale: string | null
}

export const login = (username: string, password: string): Promise<SessionState> =>
  post<SessionState>('/session', { username, password })

export const fetchSession = (): Promise<SessionState> => get<SessionState>('/session')

export const selectWorkspace = (workspaceId: Id): Promise<{ workspaceId: Id; role: Role }> =>
  patch<{ workspaceId: Id; role: Role }>('/session', { workspaceId })

export const saveLocale = (locale: string): Promise<{ locale: string }> =>
  patch<{ locale: string }>('/session', { locale })

export const logout = (): Promise<{ ok: boolean }> => del<{ ok: boolean }>('/session')
