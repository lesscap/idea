import type { AgentEffort } from '@idea/shared'
import type { EffortLevel } from '@anthropic-ai/claude-agent-sdk'
import type { ModelReasoningEffort } from '@openai/codex-sdk'

const privateWorkerVariable = (name: string): boolean =>
  name === 'IDEA_ENROLMENT_TOKEN' || /^IDEA_PROVIDER_.*_TOKEN$/.test(name)

export const agentEnv = (
  additions: Readonly<Record<string, string>> = {},
): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(process.env).flatMap(([name, value]) =>
      value === undefined || privateWorkerVariable(name) ? [] : [[name, value]],
    ),
  ),
  ...additions,
})

export const claudeEffort = (effort: AgentEffort | null): EffortLevel | undefined => {
  if (effort === 'minimal') throw new Error('claude does not support minimal effort')
  return effort ?? undefined
}

export const codexEffort = (effort: AgentEffort | null): ModelReasoningEffort | undefined => {
  if (effort === 'max') throw new Error('codex SDK does not support max effort')
  return effort ?? undefined
}
