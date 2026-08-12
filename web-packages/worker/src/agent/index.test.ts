import { describe, expect, it } from 'vitest'
import { claudeAdapter } from '../claude/adapter.ts'
import { codexAdapter } from '../codex/adapter.ts'
import { agentFor } from './index.ts'

describe('agent registry', () => {
  it('routes the provider kind and rejects unsupported implementations', () => {
    expect(agentFor('claude')).toBe(claudeAdapter)
    expect(agentFor('codex')).toBe(codexAdapter)
    expect(() => agentFor('unknown')).toThrow('unsupported agent kind: unknown')
  })
})
