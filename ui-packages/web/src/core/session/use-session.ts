import type { CurrentUser, Id, Role } from '@idea/shared'
import { useCallback } from 'react'
import { isUnauthorized } from '../../lib/request'
import { type SessionStatus, useSharedStore, useSharedStoreApi } from '../store'
import * as api from './api'

// Accessors and actions for the session part of shared state. Named hooks rather
// than raw `useSharedStore(s => s.user)` at every call site: a typo in an inline
// selector yields `undefined` silently, whereas a wrong hook name does not
// compile.

export const useCurrentUser = (): CurrentUser | null => useSharedStore(s => s.user)
export const useCurrentWorkspaceId = (): Id | null => useSharedStore(s => s.workspaceId)
export const useSessionStatus = (): SessionStatus => useSharedStore(s => s.status)
// The caller's role in the workspace they are currently in — null when they are
// in none. Drives which entries the UI offers at all.
export const useCurrentRole = (): Role | null => useSharedStore(s => s.role)

// Persists the language against the account, so it follows the user to another
// device. Signed-out visitors have no account to attach it to; localStorage
// covers them, and this is a no-op then.
export const useSaveLocale = (): ((locale: string) => Promise<void>) => {
  const user = useSharedStore(s => s.user)
  return useCallback(
    async locale => {
      if (!user) return
      await api.saveLocale(locale)
    },
    [user],
  )
}

// Runs once at startup. Not being signed in is the expected answer, not a
// failure, so a 401 resolves to "ready, nobody" rather than surfacing an error.
export const useLoadSession = (): (() => Promise<void>) => {
  const store = useSharedStoreApi()
  return useCallback(async () => {
    try {
      const { user, workspaceId, role } = await api.fetchSession()
      store.setState({ status: 'ready', user, workspaceId, role })
    } catch (err) {
      if (!isUnauthorized(err)) console.error('session load failed', err)
      store.setState({ status: 'ready', user: null, workspaceId: null, role: null })
    }
  }, [store])
}

export const useSignIn = (): ((username: string, password: string) => Promise<void>) => {
  const store = useSharedStoreApi()
  return useCallback(
    async (username, password) => {
      const { user, workspaceId, role } = await api.login(username, password)
      store.setState({ status: 'ready', user, workspaceId, role })
    },
    [store],
  )
}

export const useSignOut = (): (() => Promise<void>) => {
  const store = useSharedStoreApi()
  return useCallback(async () => {
    await api.logout()
    store.setState({ user: null, workspaceId: null, role: null })
  }, [store])
}

export const useChooseWorkspace = (): ((workspaceId: Id) => Promise<void>) => {
  const store = useSharedStoreApi()
  return useCallback(
    async workspaceId => {
      // The server verifies membership before accepting the change, and again on
      // every later request — this only mirrors the result locally.
      const { role } = await api.selectWorkspace(workspaceId)
      store.setState({ workspaceId, role })
    },
    [store],
  )
}

// Used by the invite flow, which signs a user in as a side effect of accepting
// rather than through the login form.
export const useRefreshSession = (): (() => Promise<void>) => {
  const store = useSharedStoreApi()
  return useCallback(async () => {
    const { user, workspaceId, role } = await api.fetchSession()
    store.setState({ status: 'ready', user, workspaceId, role })
  }, [store])
}
