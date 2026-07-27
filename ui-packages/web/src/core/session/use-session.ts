import type { CurrentUser, Id, Role } from '@idea/shared'
import { useCallback } from 'react'
import { isUnauthorized } from '../../lib/request.ts'
import * as api from './api.ts'
import { type SessionStatus, useSessionStore } from './store.tsx'

// Accessors and actions for the session store. Named hooks rather than raw
// `useSessionStore(s => s.user)` at every call site: a typo in an inline
// selector yields `undefined` silently, whereas a wrong hook name does not
// compile.

export const useCurrentUser = (): CurrentUser | null => useSessionStore(s => s.user)
export const useCurrentWorkspaceId = (): Id | null => useSessionStore(s => s.workspaceId)
export const useSessionStatus = (): SessionStatus => useSessionStore(s => s.status)
// The caller's role in the workspace they are currently in — null when they are
// in none. Drives which entries the UI offers at all.
export const useCurrentRole = (): Role | null => useSessionStore(s => s.role)

// Runs once at startup. Not being signed in is the expected answer, not a
// failure, so a 401 resolves to "ready, nobody" rather than surfacing an error.
export const useLoadSession = (): (() => Promise<void>) => {
  const set = useSessionStore(s => s.set)
  return useCallback(async () => {
    try {
      const { user, workspaceId, role } = await api.fetchSession()
      set({ status: 'ready', user, workspaceId, role })
    } catch (err) {
      if (!isUnauthorized(err)) console.error('session load failed', err)
      set({ status: 'ready', user: null, workspaceId: null, role: null })
    }
  }, [set])
}

export const useSignIn = (): ((username: string, password: string) => Promise<void>) => {
  const set = useSessionStore(s => s.set)
  return useCallback(
    async (username, password) => {
      const { user, workspaceId, role } = await api.login(username, password)
      set({ status: 'ready', user, workspaceId, role })
    },
    [set],
  )
}

export const useSignOut = (): (() => Promise<void>) => {
  const set = useSessionStore(s => s.set)
  return useCallback(async () => {
    await api.logout()
    set({ user: null, workspaceId: null, role: null })
  }, [set])
}

export const useChooseWorkspace = (): ((workspaceId: Id) => Promise<void>) => {
  const set = useSessionStore(s => s.set)
  return useCallback(
    async workspaceId => {
      // The server verifies membership before accepting the change, and again on
      // every later request — this only mirrors the result locally.
      const { role } = await api.selectWorkspace(workspaceId)
      set({ workspaceId, role })
    },
    [set],
  )
}

// Used by the invite flow, which signs a user in as a side effect of accepting
// rather than through the login form.
export const useRefreshSession = (): (() => Promise<void>) => {
  const set = useSessionStore(s => s.set)
  return useCallback(async () => {
    const { user, workspaceId, role } = await api.fetchSession()
    set({ status: 'ready', user, workspaceId, role })
  }, [set])
}
