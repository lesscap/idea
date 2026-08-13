import type { ConversationSummary, Paged } from '@idea/shared'
import { get } from '../../lib/request'
import { type ConversationScope, conversationScopePath } from './scope'

export const conversationsPath = (scope: ConversationScope): string =>
  `${conversationScopePath(scope)}/conversations`

export const workersPath = (scope: ConversationScope): string =>
  `${conversationScopePath(scope)}/workers`

export const filesPath = (scope: ConversationScope): string =>
  `${conversationScopePath(scope)}/files`

export const listConversations = (
  scope: ConversationScope,
  page = 1,
): Promise<Paged<ConversationSummary>> =>
  get<Paged<ConversationSummary>>(`${conversationsPath(scope)}?page=${page}`)

export const latestConversation = async (scope: ConversationScope): Promise<string | null> =>
  (await listConversations(scope, 1)).items[0]?.cid ?? null
