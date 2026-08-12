import type { AgentEffort } from '@idea/shared'

const EFFORTS: readonly AgentEffort[] = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const effort = (value: string): value is AgentEffort =>
  EFFORTS.some(candidate => candidate === value)

export type ModelCommand =
  | { kind: 'reset' }
  | { kind: 'apply'; model: string; effort: AgentEffort | null }
  | { kind: 'invalid' }

export const parseModelCommand = (input: string): ModelCommand | null => {
  const parts = input.trim().split(/\s+/)
  if (parts[0] !== '/model') return null
  if (parts.length === 1) return { kind: 'reset' }
  const model = parts[1]
  if (!model || parts.length > 3) return { kind: 'invalid' }
  const requestedEffort = parts[2]
  if (requestedEffort !== undefined && !effort(requestedEffort)) return { kind: 'invalid' }
  return { kind: 'apply', model, effort: requestedEffort ?? null }
}

export type ModelSuggestion = { label: string; model: string | null }

export const modelSuggestions = (
  input: string,
  models: readonly string[],
): readonly ModelSuggestion[] => {
  const match = input.match(/^\/model(?:\s+([^\s]*))?$/)
  if (!match) return []
  const query = (match[1] ?? '').toLowerCase()
  return [
    ...(query ? [] : [{ label: '/model', model: null }]),
    ...models
      .filter(model => model.toLowerCase().includes(query))
      .map(model => ({ label: `/model ${model}`, model })),
  ]
}
