import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ConversationEvent, StoredEvent } from '@idea/shared'
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
// canonical transcript is complete, so the person sees no break — only the
// agent's own memory of tool calls is lost, and with no tools there is nothing
// to lose yet.
export const asContext = (events: readonly StoredEvent[], next: string): string => {
  const lines = events.flatMap(({ event }) => {
    if (event.type === 'user_message') return [`Them: ${event.text}`]
    if (event.type === 'item.completed' && event.item.type === 'agent_message')
      return [`You: ${event.item.text}`]
    return []
  })
  if (lines.length === 0) return next
  return [
    'Here is the conversation so far, which you are continuing:',
    '',
    ...lines,
    '',
    `Them: ${next}`,
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

  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal.addEventListener('abort', abort)

  const messages = query({
    prompt: options.prompt,
    options: {
      cwd: options.worktree,
      // THE security boundary for this slice. The agent runs instructions that
      // arrive from outside, on a machine with other people's work on it. With
      // no tools it reaches neither the filesystem nor a shell — stricter than
      // a container, and free. Opening this up is what makes a container
      // necessary, and that is a separate change.
      //
      // `tools: []` is the option that does this. `allowedTools: []` reads like
      // it would and does not: it is the AUTO-APPROVE list, so an empty one
      // leaves every tool available and merely unapproved. A live run showed
      // the agent reaching for Bash against ~/.ssh/id_rsa — stopped by the
      // permission prompt and the working-directory limit, neither of which was
      // the boundary being relied on.
      tools: [],
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
        ...process.env,
        CLAUDE_CONFIG_DIR: options.sessions,
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
