import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { codexEffort } from '../agent/env.ts'
import { canResume, runCodex } from './session.ts'

const sdk = vi.hoisted(() => ({
  Codex: vi.fn(),
  runStreamed: vi.fn(),
}))

vi.mock('@openai/codex-sdk', () => ({ Codex: sdk.Codex }))

const roots: string[] = []
beforeEach(() => {
  sdk.Codex.mockReset()
  sdk.runStreamed.mockReset()
})
afterEach(() =>
  roots.splice(0).forEach(root => {
    rmSync(root, { recursive: true, force: true })
  }),
)

describe('Codex local state', () => {
  it('finds a rollout by native thread id', () => {
    const root = mkdtempSync(join(tmpdir(), 'idea-codex-'))
    roots.push(root)
    const sessions = join(root, 'sessions', '2026', '08', '12')
    mkdirSync(sessions, { recursive: true })
    writeFileSync(join(sessions, 'rollout-2026-08-12T00-00-00-thread-1.jsonl'), '')

    expect(canResume(root, 'thread-1')).toBe(true)
    expect(canResume(root, 'thread-2')).toBe(false)
  })

  it('rejects effort levels the SDK cannot express instead of silently degrading them', () => {
    expect(() => codexEffort('max')).toThrow('codex SDK does not support max effort')
    expect(codexEffort('minimal')).toBe('minimal')
    expect(codexEffort(null)).toBeUndefined()
  })

  it('uses HTTPS immediately when the host cannot carry Responses WebSockets', async () => {
    sdk.runStreamed.mockResolvedValue({
      events: (async function* () {
        yield { type: 'turn.completed', usage: {} }
      })(),
    })
    sdk.Codex.mockImplementation(() => ({
      startThread: () => ({ runStreamed: sdk.runStreamed }),
    }))

    const events = runCodex({
      prompt: 'reply OK',
      worktree: '/tmp/worktree',
      sessions: '/tmp/sessions',
      codexHome: '/tmp/codex',
      provider: { model: 'gpt-5.6-sol' },
      model: 'gpt-5.6-sol',
      effort: null,
      images: [],
      resume: null,
      scope: 'test',
      signal: new AbortController().signal,
      log: vi.fn(),
    })
    for await (const _event of events) void _event

    expect(sdk.Codex).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          model_provider: 'idea-openai',
          model_providers: {
            'idea-openai': expect.objectContaining({
              base_url: 'https://chatgpt.com/backend-api/codex',
              requires_openai_auth: true,
              supports_websockets: false,
            }),
          },
        },
      }),
    )
  })
})
