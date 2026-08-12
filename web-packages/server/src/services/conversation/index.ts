import type { Service } from '../../types.ts'
import { createConversationEventLog } from './event-log.ts'
import { createConversationRecords } from './records.ts'
import type { ConversationService } from './types.ts'

export type {
  AppendHook,
  Conversation,
  ConversationService,
  EventFactory,
  EventWindow,
} from './types.ts'

export const createConversationService: Service<ConversationService> = app => ({
  ...createConversationRecords(app),
  ...createConversationEventLog(app),
})
