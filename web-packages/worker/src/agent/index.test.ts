import { describe, expect, it } from 'vitest'
import { claudeAdapter } from '../claude/adapter.ts'
import { agentFor } from './index.ts'

describe('agent registry', () => {
  it('routes the provider kind and rejects unsupported implementations', () => {
    expect(agentFor('claude')).toBe(claudeAdapter)
    expect(() => agentFor('codex')).toThrow('unsupported agent kind: codex')
  })
})
