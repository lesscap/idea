import type { CurrentUser, Id, Role } from '@idea/shared'
import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

// The application's one shared state container.
//
// This file owns data only. Session, layout and future domains expose their
// selectors, actions and persistence from their own modules, all built on this
// base store. Keeping operations out of the state definition lets those domains
// grow independently without turning the store into an application service.
export type SessionStatus = 'loading' | 'ready'

export type SharedStateData = {
  status: SessionStatus
  user: CurrentUser | null
  workspaceId: Id | null
  role: Role | null
  sideCollapsed: boolean
  conversationCollapsed: boolean
}

const DEFAULTS: SharedStateData = {
  status: 'loading',
  user: null,
  workspaceId: null,
  role: null,
  sideCollapsed: false,
  conversationCollapsed: false,
}

const buildStore = (initial: Partial<SharedStateData>) =>
  createStore<SharedStateData>()(() => ({
    ...DEFAULTS,
    ...initial,
  }))

const SharedStoreContext = createContext<StoreApi<SharedStateData> | null>(null)

export const SharedStoreProvider = ({
  initial = {},
  children,
}: {
  initial?: Partial<SharedStateData>
  children: ReactNode
}) => {
  const ref = useRef<StoreApi<SharedStateData> | null>(null)
  if (!ref.current) ref.current = buildStore(initial)
  return <SharedStoreContext.Provider value={ref.current}>{children}</SharedStoreContext.Provider>
}

export const useSharedStoreApi = (): StoreApi<SharedStateData> => {
  const store = useContext(SharedStoreContext)
  if (!store) throw new Error('Shared store hooks must be used within SharedStoreProvider')
  return store
}

export const useSharedStore = <T,>(selector: (state: SharedStateData) => T): T => {
  const store = useSharedStoreApi()
  return useStore(store, selector)
}
