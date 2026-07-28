import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { readShellLayout } from './storage'

export type ShellLayoutState = {
  sideCollapsed: boolean
  conversationCollapsed: boolean
  set: StoreApi<ShellLayoutState>['setState']
}

const buildStore = () =>
  createStore<ShellLayoutState>(set => ({
    ...readShellLayout(),
    set,
  }))

const ShellLayoutContext = createContext<StoreApi<ShellLayoutState> | null>(null)

export const ShellLayoutProvider = ({ children }: { children: ReactNode }) => {
  const ref = useRef<StoreApi<ShellLayoutState> | null>(null)
  if (!ref.current) ref.current = buildStore()
  return <ShellLayoutContext.Provider value={ref.current}>{children}</ShellLayoutContext.Provider>
}

export const useShellLayoutStore = <T,>(selector: (state: ShellLayoutState) => T): T => {
  const store = useContext(ShellLayoutContext)
  if (!store) throw new Error('useShellLayoutStore must be used within ShellLayoutProvider')
  return useStore(store, selector)
}
