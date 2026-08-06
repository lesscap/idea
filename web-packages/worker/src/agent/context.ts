import type { ConversationEvent, StoredEvent } from '@idea/shared'
import { attachmentPrompt } from '../attachments.ts'

type UserMessage = Extract<ConversationEvent, { type: 'user_message' }>

export const userPrompt = (message: UserMessage): string => {
  const attachments = message.attachments ?? []
  const files =
    attachments.length > 0
      ? [
          'Files attached to this message are available in the working directory:',
          ...attachments.map(attachmentPrompt),
        ].join('\n')
      : ''
  return [files, message.text].filter(Boolean).join('\n\n')
}

export const asContext = (events: readonly StoredEvent[], next: UserMessage): string => {
  const lines = events.flatMap(({ event }) => {
    if (event.type === 'user_message') return [`Them: ${userPrompt(event)}`]
    if (event.type === 'item.completed' && event.item.type === 'agent_message')
      return [`You: ${event.item.text}`]
    return []
  })
  const current = userPrompt(next)
  if (lines.length === 0) return current
  return [
    'Here is the conversation so far, which you are continuing:',
    '',
    ...lines,
    '',
    `Them: ${current}`,
  ].join('\n')
}
