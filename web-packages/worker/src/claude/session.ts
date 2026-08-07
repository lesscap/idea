import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ConversationEvent } from '@idea/shared'
import type { AgentRunOptions } from '../agent/index.ts'
import { claudeEvents } from './events.ts'
import type { SdkMessage } from './sdk-types.ts'

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

// Minimal on purpose. What to ask and in what order belongs to a skill, and
// this is the seam it will be injected at — not a place to accumulate
// instructions in the meantime.
const SYSTEM_PROMPT =
  'You are helping someone who does not write software describe what they need. ' +
  'Ask about what is unclear, one thing at a time, in their language.'

export const runClaude = (options: AgentRunOptions): AsyncIterable<ConversationEvent> => {
  const token = process.env[options.provider.tokenEnv]
  if (!token) throw new Error(`${options.provider.tokenEnv} is not set`)
  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => name !== 'IDEA_ENROLMENT_TOKEN' && !/^IDEA_PROVIDER_.*_TOKEN$/.test(name),
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
      // Environment scrubbing protects provider credentials from commands the
      // agent launches. Claude Code's hardening keeps permission mode at
      // `default` unless the executable tool surface is explicit.
      allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
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
        IS_SANDBOX: '1',
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
