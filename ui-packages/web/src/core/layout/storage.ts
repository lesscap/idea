import type { SharedStateData } from '../store'

export type LayoutState = Pick<SharedStateData, 'workspaceSidebarCollapsed' | 'studioChatCollapsed'>

const WORKSPACE_SIDE_KEY = 'idea.workspace.sidebar-collapsed'
const STUDIO_CHAT_KEY = 'idea.studio.chat-collapsed'

const readFlag = (key: string): boolean => {
  try {
    return globalThis.localStorage?.getItem(key) === '1'
  } catch {
    return false
  }
}

const writeFlag = (key: string, value: boolean): void => {
  try {
    globalThis.localStorage?.setItem(key, value ? '1' : '0')
  } catch {
    // A layout preference is optional; the panels still work without storage.
  }
}

export const readLayoutState = (): LayoutState => ({
  workspaceSidebarCollapsed: readFlag(WORKSPACE_SIDE_KEY),
  studioChatCollapsed: readFlag(STUDIO_CHAT_KEY),
})

export const persistWorkspaceSidebarCollapsed = (value: boolean): void =>
  writeFlag(WORKSPACE_SIDE_KEY, value)
export const persistStudioChatCollapsed = (value: boolean): void =>
  writeFlag(STUDIO_CHAT_KEY, value)
