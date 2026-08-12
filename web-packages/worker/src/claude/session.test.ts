import type { StoredEvent } from '@idea/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { asContext, userPrompt } from '../agent/context.ts'
import { claudeEffort } from '../agent/env.ts'
import { runClaude } from './session.ts'

const query = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query }))

afterEach(() => {
  query.mockReset()
  vi.unstubAllEnvs()
})

const stored = (sequence: number, event: StoredEvent['event']): StoredEvent => ({
  id: sequence + 1,
  sequence,
  createdAt: '2026-07-31T00:00:00.000Z',
  event,
})

describe('Claude conversation context', () => {
  it('rejects minimal effort instead of silently promoting it to low', () => {
    expect(() => claudeEffort('minimal')).toThrow('claude does not support minimal effort')
    expect(claudeEffort('low')).toBe('low')
    expect(claudeEffort(null)).toBeUndefined()
  })

  it('includes historical attachment paths and the current message once', () => {
    const previous = stored(0, {
      type: 'user_message',
      text: '先看背景',
      attachments: [
        { fid: 'old123', filename: '背景.pdf', contentType: 'application/pdf', size: 10 },
      ],
    })
    const current = {
      type: 'user_message' as const,
      text: '再看这份',
      attachments: [
        { fid: 'new123', filename: '需求.docx', contentType: 'application/docx', size: 20 },
      ],
    }

    const prompt = asContext([previous], current)

    expect(prompt).toContain('attachments/old123/背景.pdf')
    expect(prompt).toContain('attachments/new123/需求.docx')
    expect(prompt.match(/再看这份/g)).toHaveLength(1)
    expect(userPrompt(current)).not.toContain('先看背景')
  })

  it('opens the native tool surface without exposing worker credentials to subprocesses', async () => {
    query.mockReturnValue({
      [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }),
    })
    vi.stubEnv('IDEA_PROVIDER_GLM_TOKEN', 'glm-secret')
    vi.stubEnv('IDEA_PROVIDER_DEEPSEEK_TOKEN', 'deepseek-secret')
    vi.stubEnv('IDEA_ENROLMENT_TOKEN', 'enrolment-secret')

    const stream = runClaude({
      prompt: 'hello',
      worktree: '/tmp/worktree',
      sessions: '/tmp/sessions',
      codexHome: '/tmp/codex',
      provider: {
        baseUrl: 'https://provider.example',
        model: 'model-1',
        tokenEnv: 'IDEA_PROVIDER_GLM_TOKEN',
      },
      model: 'model-1',
      effort: null,
      images: [],
      resume: null,
      scope: 't1',
      signal: new AbortController().signal,
      log: vi.fn(),
    })
    for await (const _event of stream) void _event

    const options = query.mock.calls[0]?.[0].options
    expect(options).toMatchObject({
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
      env: {
        ANTHROPIC_AUTH_TOKEN: 'glm-secret',
        CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1',
        IS_SANDBOX: '1',
      },
    })
    expect(options.tools).toBeUndefined()
    expect(options.env.IDEA_PROVIDER_GLM_TOKEN).toBeUndefined()
    expect(options.env.IDEA_PROVIDER_DEEPSEEK_TOKEN).toBeUndefined()
    expect(options.env.IDEA_ENROLMENT_TOKEN).toBeUndefined()
  })
})
