import type { ConversationEvent } from '@idea/shared'
import { claudeAdapter } from '../claude/adapter.ts'

export type ProviderConfig = {
  baseUrl: string
  model: string
  tokenEnv: string
}

export type AgentRunOptions = {
  prompt: string
  worktree: string
  sessions: string
  provider: ProviderConfig
  resume: string | null
  scope: string
  signal: AbortSignal
  log: (message: string) => void
}

export type TitleSeed = { userText: string; assistantText: string }
export type TitleOutcome =
  | { kind: 'titled'; title: string }
  | { kind: 'declined' }
  | { kind: 'error'; reason: string }

export type AgentAdapter = {
  canResume: (sessions: string, sessionId: string | null) => boolean
  run: (options: AgentRunOptions) => AsyncIterable<ConversationEvent>
  generateTitle: (input: {
    provider: ProviderConfig
    worktree: string
    sessions: string
    seed: TitleSeed
  }) => Promise<TitleOutcome>
}

const ADAPTERS: Readonly<Record<string, AgentAdapter>> = {
  claude: claudeAdapter,
}

export const agentFor = (kind: string): AgentAdapter => {
  const adapter = ADAPTERS[kind]
  if (!adapter) throw new Error(`unsupported agent kind: ${kind}`)
  return adapter
}
