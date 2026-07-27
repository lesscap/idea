import type { CurrentUser, Id } from '@idea/shared'
import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

// The application's only global state: who is signed in, and which workspace is
// currently selected.
//
// It earns a store because it is read across most screens AND has definite
// moments at which it goes stale — sign in, sign out, switch workspace. That
// pairing is the bar for anything else proposed here. Data with no clear
// invalidation point (an app list, say) stays in the page that shows it, where
// "when is this wrong?" has an obvious answer.
//
// Built per-provider rather than at module scope. A module-level `create()` is a
// process-wide singleton: state survives between tests, and two roots on one
// page would silently share it.
//
// Not persisted. The httpOnly cookie is the source of truth for being signed in;
// mirroring that into localStorage lets the two disagree once the cookie
// expires, and puts identity somewhere page scripts can read.
//
// Convention (from term-web): this file holds STATE ONLY — the shape, the store
// construction, the provider, and the base hook. Every accessor and action lives
// in use-session.ts. Keeping them apart is what stops this file from slowly
// turning into the whole feature.
export type SessionStatus = 'loading' | 'ready'

export type SessionState = {
  status: SessionStatus
  user: CurrentUser | null
  workspaceId: Id | null
  set: StoreApi<SessionState>['setState']
}

const buildStore = () =>
  createStore<SessionState>(set => ({
    status: 'loading',
    user: null,
    workspaceId: null,
    set,
  }))

const SessionStoreContext = createContext<StoreApi<SessionState> | null>(null)

export const SessionStoreProvider = ({ children }: { children: ReactNode }) => {
  // useRef, not useState or a module constant: created once per provider, and
  // never rebuilt on re-render.
  const ref = useRef<StoreApi<SessionState> | null>(null)
  if (!ref.current) ref.current = buildStore()
  return <SessionStoreContext.Provider value={ref.current}>{children}</SessionStoreContext.Provider>
}

// Always takes a selector — there is no way to subscribe to the whole store.
// Whole-store subscriptions re-render every consumer on any field change, and
// nothing errors: the app just gets slower, which is why it has to be
// prevented rather than caught in review.
export const useSessionStore = <T,>(selector: (state: SessionState) => T): T => {
  const store = useContext(SessionStoreContext)
  if (!store) throw new Error('useSessionStore must be used within SessionStoreProvider')
  return useStore(store, selector)
}
