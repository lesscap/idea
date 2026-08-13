import type { Id } from '@idea/shared'

export type ConversationScope =
  | { readonly type: 'workspace' }
  | { readonly type: 'app'; readonly appId: Id }

export const conversationScopePath = (scope: ConversationScope): string =>
  scope.type === 'workspace' ? '/workspace' : `/apps/${scope.appId}`
