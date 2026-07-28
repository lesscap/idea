import type { Id, StoredEvent } from '@idea/shared'

// Transcript events, pushed to whoever is watching a conversation.
//
// Live-only, and for the same reason the command bus is: the durable transcript
// is the truth, and a subscriber that misses a frame asks for what it missed by
// sequence rather than relying on delivery. So this needs no buffer, no
// acknowledgement, and no replay — losing a frame costs a round trip, never a
// message.
//
// Separate from `command-bus.ts` despite the identical shape. That one is
// server→worker and keyed by worker; this is server→browser and keyed by
// conversation. Merging them would put two audiences behind one key and make
// "who is allowed to hear this" a question with two answers.

type Send = (event: StoredEvent) => void

export type EventBus = {
  subscribe: (conversationId: Id, send: Send) => () => void
  publish: (conversationId: Id, event: StoredEvent) => void
}

export const createEventBus = (): EventBus => {
  const subscribers = new Map<Id, Set<Send>>()

  return {
    subscribe: (conversationId, send) => {
      const existing = subscribers.get(conversationId) ?? new Set<Send>()
      existing.add(send)
      subscribers.set(conversationId, existing)

      return () => {
        existing.delete(send)
        if (existing.size === 0) subscribers.delete(conversationId)
      }
    },

    // Several people may be watching the same conversation — a colleague looking
    // over the same requirement, or the same person in two tabs.
    publish: (conversationId, event) => {
      for (const send of subscribers.get(conversationId) ?? []) send(event)
    },
  }
}
