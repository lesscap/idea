import { useCallback } from 'react'
import { useSharedStore, useSharedStoreApi } from '../store'
import { persistConversationCollapsed, persistSideCollapsed } from './storage'

export const useSideCollapsed = (): boolean => useSharedStore(s => s.sideCollapsed)

export const useConversationCollapsed = (): boolean => useSharedStore(s => s.conversationCollapsed)

export const useToggleSide = (): (() => void) => {
  const store = useSharedStoreApi()
  return useCallback(
    () =>
      store.setState(state => {
        const sideCollapsed = !state.sideCollapsed
        persistSideCollapsed(sideCollapsed)
        return { sideCollapsed }
      }),
    [store],
  )
}

export const useSetConversationCollapsed = (): ((collapsed: boolean) => void) => {
  const store = useSharedStoreApi()
  return useCallback(
    conversationCollapsed =>
      store.setState(state => {
        if (state.conversationCollapsed === conversationCollapsed) return state
        persistConversationCollapsed(conversationCollapsed)
        return { conversationCollapsed }
      }),
    [store],
  )
}
