import type { ThreadEvent } from '@openai/codex-sdk'
import { describe, expect, it } from 'vitest'
import { codexEvent } from './events.ts'

describe('Codex event normalization', () => {
  it('keeps the native thread id and suppresses the duplicate turn start', () => {
    expect(codexEvent({ type: 'thread.started', thread_id: 'thread-1' })).toMatchObject({
      type: 'thread.started',
      providerSessionId: 'thread-1',
    })
    expect(codexEvent({ type: 'turn.started' })).toBeNull()
  })

  it('normalizes command progress and usage', () => {
    const started: ThreadEvent = {
      type: 'item.started',
      item: {
        type: 'command_execution',
        id: 'command-1',
        command: 'pnpm test',
        aggregated_output: 'running',
        status: 'in_progress',
      },
    }
    expect(codexEvent(started)).toMatchObject({
      type: 'item.started',
      item: { id: 'command-1', status: 'in_progress', output: 'running' },
    })
    expect(
      codexEvent({
        type: 'turn.completed',
        usage: {
          input_tokens: 10,
          cached_input_tokens: 4,
          cache_write_input_tokens: 0,
          output_tokens: 6,
          reasoning_output_tokens: 2,
        },
      }),
    ).toMatchObject({
      type: 'turn.completed',
      usage: { inputTokens: 10, cachedInputTokens: 4, outputTokens: 6 },
    })
  })

  it('turns terminal failures into the runner error path', () => {
    expect(() =>
      codexEvent({ type: 'turn.failed', error: { message: 'unsupported model' } }),
    ).toThrow('unsupported model')
  })

  it('keeps transport errors as non-terminal provider notices', () => {
    expect(codexEvent({ type: 'error', message: 'Reconnecting... 2/5' })).toMatchObject({
      type: 'system',
      action: 'provider_notice',
      message: 'Reconnecting... 2/5',
    })
  })

  it('preserves a future SDK event as raw data', () => {
    const event = { type: 'future.event', value: 1 }
    expect(codexEvent(event as never)).toEqual({ type: 'raw', raw: event })
  })
})
