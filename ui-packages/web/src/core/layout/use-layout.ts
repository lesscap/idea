import { useCallback } from 'react'
import { useSharedStore, useSharedStoreApi } from '../store'
import { persistStudioChatCollapsed, persistWorkspaceSidebarCollapsed } from './storage'

type LayoutKey = 'workspaceSidebarCollapsed' | 'studioChatCollapsed'

const persist = (key: LayoutKey, value: boolean): void => {
  if (key === 'workspaceSidebarCollapsed') persistWorkspaceSidebarCollapsed(value)
  else persistStudioChatCollapsed(value)
}

const useLayoutFlag = (key: LayoutKey): readonly [boolean, (value: boolean) => void] => {
  const value = useSharedStore(state => state[key])
  const store = useSharedStoreApi()
  const set = useCallback(
    (next: boolean) => {
      store.setState(state => {
        if (state[key] === next) return state
        persist(key, next)
        return { [key]: next }
      })
    },
    [key, store],
  )
  return [value, set]
}

export const useWorkspaceSidebar = () => useLayoutFlag('workspaceSidebarCollapsed')
export const useStudioChat = () => useLayoutFlag('studioChatCollapsed')
