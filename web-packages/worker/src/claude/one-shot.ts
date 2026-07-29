import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SdkMessage } from './sdk-types.ts'
import type { ProviderConfig } from './session.ts'

// Ask the model one question, take back one string.
//
// Not part of any conversation: no session to resume, nothing appended to a
// transcript, no events published. Titling is the first caller; turning a
// conversation into structured requirements will be the second.
//
// Separate from runClaude rather than a flag on it, because nearly everything
// differs — that one carries a fixed system prompt, resumes a provider session,
// and yields the normalised event stream. What the two share is how a provider
// becomes SDK options, which is four lines and clearer said twice than hidden
// behind a parameter meaning "and also behave completely differently".
//
// Lives under claude/ because it IS the Claude SDK call. A worker process serves
// one provider (see config.ts), so there is nothing here to branch on; another
// backend gets its own module beside this one, not a case inside it.

export type OneShotResult = { kind: 'text'; text: string } | { kind: 'error'; reason: string }

// Cold spawns through a proxy routinely take more than half a minute — config
// sync and TLS before a single token comes back. A one-shot is worthless if it
// costs a minute, but too tight a bound kills every attempt rather than some,
// and silently: the failure looks identical to the model declining.
const TIMEOUT_MS = 90_000

// Enough to say what went wrong in a log line without pasting a stack.
const STDERR_TAIL = 3

export const oneShot = async (input: {
  provider: ProviderConfig
  // Where the call runs. Nothing here reads files — `tools: []` sees to that —
  // but the SDK still wants somewhere to be.
  worktree: string
  // CLAUDE_CONFIG_DIR, shared with the conversation's own session directory.
  sessions: string
  systemPrompt: string
  prompt: string
}): Promise<OneShotResult> => {
  const token = process.env[input.provider.tokenEnv]
  if (!token) return { kind: 'error', reason: `${input.provider.tokenEnv} is not set` }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const stderr: string[] = []
  let text = ''
  let sawResult = false
  let failure = ''

  try {
    const messages = query({
      prompt: input.prompt,
      options: {
        cwd: input.worktree,
        // The same boundary the conversation runs behind. A summarising call has
        // no more business reaching a shell than the agent does.
        tools: [],
        // The caller's persona, not the product's. Inside the agent harness the
        // model answers a titling ask with NONE surprisingly often; a plain
        // one-line persona both works and costs a fraction, since the harness
        // preset is itself thousands of tokens.
        systemPrompt: input.systemPrompt,
        // Do not load the worktree's CLAUDE.md or project settings. They are
        // written to steer an agent doing work, and they steer this into long
        // prose exactly when something short was asked for.
        settingSources: [],
        abortController: controller,
        stderr: line => {
          if (!line.trim()) return
          stderr.push(line.trim().slice(0, 200))
          if (stderr.length > STDERR_TAIL) stderr.shift()
        },
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: input.sessions,
          ANTHROPIC_BASE_URL: input.provider.baseUrl,
          ANTHROPIC_AUTH_TOKEN: token,
        },
        model: input.provider.model,
      },
    }) as AsyncIterable<SdkMessage>

    for await (const message of messages) {
      if (message.type !== 'result') continue
      sawResult = true
      if (message.subtype === 'success' && typeof message.result === 'string') text = message.result
      else failure = `result ${message.subtype ?? 'unknown'}`
    }
  } catch (error) {
    failure = controller.signal.aborted
      ? `timeout after ${TIMEOUT_MS / 1000}s`
      : String(error).slice(0, 300)
  } finally {
    clearTimeout(timer)
  }

  // A stream that ends without one is a failure that reports itself as an empty
  // answer, which downstream would read as "the model had nothing to say".
  if (!failure && !sawResult) failure = 'stream ended without a result'
  if (!failure) return { kind: 'text', text }

  const tail = stderr.length > 0 ? ` | stderr: ${stderr.join(' / ')}` : ''
  return { kind: 'error', reason: `${failure}${tail}` }
}
