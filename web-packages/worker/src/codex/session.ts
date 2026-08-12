import { existsSync, readdirSync } from 'node:fs'
import type { ConversationEvent } from '@idea/shared'
import type { Input, ThreadOptions } from '@openai/codex-sdk'
import { SYSTEM_PROMPT } from '../agent/context.ts'
import { codexEffort } from '../agent/env.ts'
import type { AgentRunOptions } from '../agent/index.ts'
import { createCodexClient } from './client.ts'
import { codexEvent } from './events.ts'

export const canResume = (codexHome: string, sessionId: string | null): boolean => {
  if (!sessionId || !existsSync(codexHome)) return false
  const found = (path: string): boolean =>
    readdirSync(path, { withFileTypes: true }).some(entry => {
      if (entry.isFile()) return entry.name.endsWith(`-${sessionId}.jsonl`)
      return entry.isDirectory() && found(`${path}/${entry.name}`)
    })
  try {
    return found(codexHome)
  } catch {
    return false
  }
}

const inputFor = (options: AgentRunOptions): Input => [
  { type: 'text', text: `${SYSTEM_PROMPT}\n\n${options.prompt}` },
  ...options.images.map(path => ({ type: 'local_image' as const, path })),
]

export const runCodex = async function* (
  options: AgentRunOptions,
): AsyncIterable<ConversationEvent> {
  const reasoningEffort = codexEffort(options.effort)
  const threadOptions: ThreadOptions = {
    workingDirectory: options.worktree,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    model: options.model,
    ...(reasoningEffort ? { modelReasoningEffort: reasoningEffort } : {}),
  }
  const codex = createCodexClient(options.codexHome)
  const thread = options.resume
    ? codex.resumeThread(options.resume, threadOptions)
    : codex.startThread(threadOptions)
  options.log(
    `[codex] model=${options.model}${reasoningEffort ? ` effort=${reasoningEffort}` : ''}`,
  )

  const { events } = await thread.runStreamed(inputFor(options), { signal: options.signal })
  let completed = false
  let lastNotice: string | null = null
  for await (const raw of events) {
    const event = codexEvent(raw)
    if (event?.type === 'turn.completed') completed = true
    if (event?.type === 'system' && event.action === 'provider_notice')
      lastNotice = event.message ?? null
    if (event) yield event
  }
  if (!completed) throw new Error(lastNotice ?? 'codex stream ended before the turn completed')
}
