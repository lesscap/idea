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

// The one setter with a cycle behind it. The shell drives the resizable panel
// from this value and writes it back from the panel's onResize, so the round
// trip is: setState → layout effect → panel.collapse() → onResize → setState.
//
// The equality check below is what ends that round trip, and it is the ONLY
// thing that does. It looks like an optimisation — "skip a redundant write" —
// and removing it as one hangs the browser rather than merely costing a render.
// Persisting inside the same branch is deliberate for the same reason: a
// preference is written when it actually changes, not on every echo.
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
