import { useCallback } from 'react'
import { persistConversationCollapsed, persistSideCollapsed } from './storage'
import { useShellLayoutStore } from './store'

export const useSideCollapsed = (): boolean => useShellLayoutStore(s => s.sideCollapsed)

export const useConversationCollapsed = (): boolean =>
  useShellLayoutStore(s => s.conversationCollapsed)

export const useToggleSide = (): (() => void) => {
  const set = useShellLayoutStore(s => s.set)
  return useCallback(
    () =>
      set(state => {
        const sideCollapsed = !state.sideCollapsed
        persistSideCollapsed(sideCollapsed)
        return { sideCollapsed }
      }),
    [set],
  )
}

export const useSetConversationCollapsed = (): ((collapsed: boolean) => void) => {
  const set = useShellLayoutStore(s => s.set)
  return useCallback(
    conversationCollapsed =>
      set(state => {
        if (state.conversationCollapsed === conversationCollapsed) return state
        persistConversationCollapsed(conversationCollapsed)
        return { conversationCollapsed }
      }),
    [set],
  )
}
