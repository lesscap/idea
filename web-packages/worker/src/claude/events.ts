import type { AgentItem, ConversationEvent } from '@idea/shared'
import type { SdkBlock, SdkMessage } from './sdk-types.ts'

// Claude's message stream, translated into the canonical vocabulary.
//
// Two things this absorbs so that nothing downstream has to:
//
// PAIRING. Claude emits a `tool_use` block in one message and its `tool_result`
// in a later one, so a consumer reading the raw stream has to hold state and
// match them up. The canonical form is self-contained items, so that matching
// happens once, here, and the transcript, the interface and anything reading it
// later all see a finished tool call rather than two halves.
//
// It does NOT open the turn. `turn.started` carries the sequence of the message
// being answered, which only the caller knows — this adapter sees a provider
// stream, not our transcript. Emitting it here as well put two of them in every
// turn, visible the first time a real conversation ran.
//
// IDENTITY. Claude gives no id to text or thinking blocks. Items are replaced by
// id rather than appended to, so without one a streaming interface has no way to
// tell an update from a new message and shows the text twice.
//
// So they are synthesised — and the scope they must be unique in is the whole
// CONVERSATION, not this stream. A bare per-stream counter restarts at 1 every
// turn, so turn two's `msg-2` replaces turn one's answer and the transcript
// silently loses it. Hence the caller passes the turn id in front: unique within
// the conversation by construction, and already at hand where the turn runs.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const blocksOf = (message: SdkMessage): SdkBlock[] =>
  Array.isArray(message.message?.content) ? message.message.content : []

// A tool result's content is a string, or blocks that may each carry text.
const resultText = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content === undefined ? '' : JSON.stringify(content)
  return content
    .map(block =>
      isRecord(block) && typeof block.text === 'string' ? block.text : JSON.stringify(block),
    )
    .join('\n')
}

export async function* claudeEvents(
  messages: AsyncIterable<SdkMessage>,
  scope: string,
): AsyncIterable<ConversationEvent> {
  // Tool calls waiting for their result, keyed by the id Claude will quote back.
  const pending = new Map<string, Extract<AgentItem, { type: 'tool_call' }>>()
  let threadStarted = false
  let counter = 0

  const nextId = (kind: string) => `${scope}-${kind}-${++counter}`

  for await (const message of messages) {
    if (message.type === 'system') {
      // Only the first one opens the thread. Later system messages are
      // configuration notices, and emitting `thread.started` again would look
      // like a second conversation beginning inside this one.
      if (!threadStarted) {
        threadStarted = true
        yield { type: 'thread.started', providerSessionId: message.session_id ?? '', raw: message }
      }
      continue
    }

    if (message.type === 'assistant') {
      for (const block of blocksOf(message)) {
        if (block.type === 'text' && block.text) {
          yield {
            type: 'item.completed',
            item: {
              id: nextId('msg'),
              status: 'completed',
              type: 'agent_message',
              text: block.text,
            },
            raw: block,
          }
          continue
        }
        if (block.type === 'thinking' && block.thinking) {
          yield {
            type: 'item.completed',
            item: {
              id: nextId('think'),
              status: 'completed',
              type: 'reasoning',
              text: block.thinking,
            },
            raw: block,
          }
          continue
        }
        if (block.type === 'tool_use' && block.id) {
          const item: Extract<AgentItem, { type: 'tool_call' }> = {
            id: block.id,
            status: 'in_progress',
            type: 'tool_call',
            name: block.name ?? 'tool',
            input: block.input,
          }
          pending.set(block.id, item)
          yield { type: 'item.started', item, raw: block }
          continue
        }
        yield { type: 'raw', raw: block }
      }
      continue
    }

    if (message.type === 'user') {
      for (const block of blocksOf(message)) {
        // Anything else in a user message is the prompt being echoed back; the
        // transcript already holds what the person said.
        if (block.type !== 'tool_result' || !block.tool_use_id) continue

        const started = pending.get(block.tool_use_id)
        // A result with no call is not worth failing the turn over, but it is
        // worth keeping: a mapping gap should be visible, not silent.
        if (!started) {
          yield { type: 'raw', raw: block }
          continue
        }
        pending.delete(block.tool_use_id)
        yield {
          type: 'item.completed',
          // Same id as item.started — that is what makes this a replacement of
          // the running call rather than a second entry beside it.
          item: {
            ...started,
            status: block.is_error ? 'failed' : 'completed',
            output: resultText(block.content),
            ...(block.is_error ? { isError: true } : {}),
          },
          raw: block,
        }
      }
      continue
    }

    if (message.type === 'result') {
      // A stream that produced no system message still has to report which
      // session it was, or the next turn has nothing to resume from.
      if (!threadStarted && message.session_id) {
        threadStarted = true
        yield { type: 'thread.started', providerSessionId: message.session_id, raw: message }
      }
      const failed = message.is_error === true || (message.subtype ?? 'success') !== 'success'
      yield failed
        ? {
            type: 'turn.failed',
            error: { message: message.result || `claude: ${message.subtype ?? 'unknown error'}` },
            raw: message,
          }
        : { type: 'turn.completed', raw: message }
      continue
    }

    yield { type: 'raw', raw: message }
  }
}
