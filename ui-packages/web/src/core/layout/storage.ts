import type { SharedStateData } from '../store'

export type LayoutState = Pick<SharedStateData, 'sideCollapsed' | 'conversationCollapsed'>

const SIDE_KEY = 'idea.shell.side-collapsed'
const CONVERSATION_KEY = 'idea.shell.conversation-collapsed'

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
  sideCollapsed: readFlag(SIDE_KEY),
  conversationCollapsed: readFlag(CONVERSATION_KEY),
})

export const persistSideCollapsed = (value: boolean): void => writeFlag(SIDE_KEY, value)

export const persistConversationCollapsed = (value: boolean): void =>
  writeFlag(CONVERSATION_KEY, value)
