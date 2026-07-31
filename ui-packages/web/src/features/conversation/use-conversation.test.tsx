import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { del, get, post } from '../../lib/request'
import type { WireStored } from './transcript'
import { useConversation } from './use-conversation'

vi.mock('../../lib/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

class TestEventSource {
  static readonly OPEN = 1
  static readonly instances: TestEventSource[] = []

  readonly readyState = TestEventSource.OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()

  constructor(readonly url: string) {
    TestEventSource.instances.push(this)
  }

  emit(event: WireStored) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(event) }))
  }
}

const said = (id: number, sequence: number, text: string): WireStored => ({
  id,
  sequence,
  createdAt: '2026-07-29T00:00:00.000Z',
  event: { type: 'user_message', text },
})

beforeEach(() => {
  vi.mocked(del).mockReset()
  vi.mocked(get).mockReset()
  vi.mocked(post).mockReset()
  TestEventSource.instances.length = 0
})

afterEach(() => vi.unstubAllGlobals())

describe('a draft conversation', () => {
  it('persists the conversation and its first message in one request', async () => {
    vi.mocked(post).mockResolvedValue({ cid: 'abc123' })
    const created = vi.fn()
    const { result } = renderHook(() => useConversation('leave-request', 'new', created))

    await act(() => result.current.send('第一条消息', []))

    expect(post).toHaveBeenCalledWith('/apps/leave-request/conversations', {
      text: '第一条消息',
      attachmentFids: [],
    })
    expect(created).toHaveBeenCalledWith('abc123')
  })
})

describe('a persisted conversation', () => {
  it('keeps withdrawn and materialized input out of the queue', async () => {
    vi.stubGlobal('EventSource', TestEventSource)
    vi.mocked(get)
      .mockResolvedValueOnce({
        items: [said(1, 0, 'Hello')],
        pending: [
          { id: 7, text: 'hello', attachments: [], createdAt: '2026-07-29T00:01:00.000Z' },
          {
            id: 8,
            text: 'Are you OK',
            attachments: [],
            createdAt: '2026-07-29T00:02:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ items: [], pending: [] })

    const { result } = renderHook(() => useConversation('leave-request', 'conversation-1', vi.fn()))

    await waitFor(() => expect(result.current.pending).toHaveLength(2))
    vi.mocked(del).mockResolvedValue({ cancelled: true })

    await act(() => result.current.withdraw(7))

    expect(del).toHaveBeenCalledWith('/apps/leave-request/conversations/conversation-1/pending/7')
    expect(result.current.pending.map(item => item.id)).toEqual([8])

    act(() => TestEventSource.instances[0]?.emit(said(2, 1, 'Are you OK')))

    await waitFor(() => {
      expect(result.current.bubbles).toContainEqual({
        kind: 'them',
        key: 'seq:1',
        text: 'Are you OK',
      })
      expect(result.current.pending).toEqual([])
    })
  })
})
