import type { AgentItem, AgentUsage, ConversationEvent } from '@idea/shared'
import type { ThreadEvent, ThreadItem, Usage } from '@openai/codex-sdk'

const statusOf = (item: ThreadItem): AgentItem['status'] =>
  'status' in item ? item.status : item.type === 'error' ? 'failed' : 'completed'

const toItem = (item: ThreadItem): AgentItem => {
  const status = statusOf(item)
  if (item.type === 'agent_message' || item.type === 'reasoning')
    return { type: item.type, id: item.id, status, text: item.text }
  if (item.type === 'command_execution')
    return {
      type: item.type,
      id: item.id,
      status,
      command: item.command,
      output: item.aggregated_output,
      ...(item.exit_code === undefined ? {} : { exitCode: item.exit_code }),
    }
  if (item.type === 'file_change')
    return { type: item.type, id: item.id, status, changes: item.changes }
  if (item.type === 'mcp_tool_call')
    return {
      type: item.type,
      id: item.id,
      status,
      server: item.server,
      tool: item.tool,
      input: item.arguments,
      ...(item.result ? { output: item.result } : {}),
      ...(item.error ? { output: item.error } : {}),
    }
  if (item.type === 'web_search') return { type: item.type, id: item.id, status, query: item.query }
  if (item.type === 'todo_list') return { type: item.type, id: item.id, status, items: item.items }
  return { type: 'error', id: item.id, status, message: item.message }
}

const toUsage = (usage: Usage): AgentUsage => ({
  inputTokens: usage.input_tokens,
  cachedInputTokens: usage.cached_input_tokens,
  outputTokens: usage.output_tokens,
})

export const codexEvent = (event: ThreadEvent): ConversationEvent | null => {
  if (event.type === 'thread.started')
    return { type: event.type, providerSessionId: event.thread_id, raw: event }
  // runTurn already records the canonical start before invoking an adapter.
  if (event.type === 'turn.started') return null
  if (
    event.type === 'item.started' ||
    event.type === 'item.updated' ||
    event.type === 'item.completed'
  )
    return { type: event.type, item: toItem(event.item), raw: event }
  if (event.type === 'turn.completed')
    return { type: event.type, usage: toUsage(event.usage), raw: event }
  if (event.type === 'turn.failed') throw new Error(event.error.message)
  if (event.type === 'error')
    return { type: 'system', action: 'provider_notice', message: event.message, raw: event }
  return { type: 'raw', raw: event }
}
