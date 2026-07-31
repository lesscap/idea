import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ConversationEvent, StoredEvent } from '@idea/shared'
import { attachmentPrompt } from '../attachments.ts'
import { claudeEvents } from './events.ts'
import type { SdkMessage } from './sdk-types.ts'

export type ProviderConfig = {
  baseUrl: string
  model: string
  tokenEnv: string
}

export type RunOptions = {
  prompt: string
  worktree: string
  // CLAUDE_CONFIG_DIR. Beside the worktrees rather than inside one, so
  // reclaiming a worktree does not take the agent's memory with it.
  sessions: string
  provider: ProviderConfig
  // Null on the first turn, or when the local session is gone.
  resume: string | null
  // Namespaces the ids synthesised for blocks Claude leaves unidentified, so
  // one turn's answer cannot replace an earlier turn's in the transcript.
  scope: string
  signal: AbortSignal
  log: (message: string) => void
}

// Whether there is anything here to resume from.
//
// The id alone is not enough: it may have been recorded on another machine, or
// the directory may have been cleared. Asking to resume a session that is not
// there fails the turn; starting a fresh one and supplying the conversation as
// context does not.
export const canResume = (sessions: string, sessionId: string | null): boolean => {
  if (!sessionId || !existsSync(sessions)) return false
  // The SDK files sessions under a directory per working directory, so this
  // looks for the transcript anywhere beneath rather than at a path we would
  // have to reconstruct.
  const found = (dir: string, depth = 0): boolean => {
    if (depth > 3) return false
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name === `${sessionId}.jsonl`) return true
      if (entry.isDirectory() && found(join(dir, entry.name), depth + 1)) return true
    }
    return false
  }
  try {
    return found(sessions)
  } catch {
    return false
  }
}

// The conversation so far, as text, for a session that cannot be resumed. The
// canonical transcript is complete, so the person sees no break. Tool-call
// internals are not replayed, but user files are restored in the worktree and
// every message keeps the path by which the agent can inspect them again.
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

// Minimal on purpose. What to ask and in what order belongs to a skill, and
// this is the seam it will be injected at — not a place to accumulate
// instructions in the meantime.
const SYSTEM_PROMPT =
  'You are helping someone who does not write software describe what they need. ' +
  'Ask about what is unclear, one thing at a time, in their language.'

export const runClaude = (options: RunOptions): AsyncIterable<ConversationEvent> => {
  const token = process.env[options.provider.tokenEnv]
  if (!token) throw new Error(`${options.provider.tokenEnv} is not set`)
  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => name !== options.provider.tokenEnv && name !== 'IDEA_ENROLMENT_TOKEN',
    ),
  )

  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal.addEventListener('abort', abort)

  const messages = query({
    prompt: options.prompt,
    options: {
      cwd: options.worktree,
      // The worker is deployed one workspace per container. The container is
      // the execution boundary; inside it the agent gets Claude Code's normal
      // tool surface and can work without an interactive approval channel.
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      // The SDK's own question tool waits for an interactive answer. An agent
      // whose job is asking questions should ask them in the conversation,
      // where someone will see them, rather than block a turn nobody is
      // watching.
      disallowedTools: ['AskUserQuestion'],
      systemPrompt: SYSTEM_PROMPT,
      abortController: controller,
      stderr: line => options.log(`[claude] ${line.trimEnd()}`),
      ...(options.resume ? { resume: options.resume } : {}),
      env: {
        ...inheritedEnv,
        CLAUDE_CONFIG_DIR: options.sessions,
        CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1',
        ANTHROPIC_BASE_URL: options.provider.baseUrl,
        ANTHROPIC_AUTH_TOKEN: token,
      },
      model: options.provider.model,
    },
  }) as AsyncIterable<SdkMessage>

  return {
    async *[Symbol.asyncIterator]() {
      try {
        yield* claudeEvents(messages, options.scope)
      } finally {
        options.signal.removeEventListener('abort', abort)
      }
    },
  }
}
