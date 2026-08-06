import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { del, get, patch, post } from '../../lib/request'
import type { WireStored } from './transcript'
import { useConversation } from './use-conversation'

vi.mock('../../lib/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

class TestEventSource {
  static readonly OPEN = 1
  static readonly instances: TestEventSource[] = []

  readyState = 0
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

  open() {
    this.readyState = TestEventSource.OPEN
    this.onopen?.()
  }

  fail() {
    this.onerror?.()
  }
}

const said = (id: number, sequence: number, text: string): WireStored => ({
  id,
  sequence,
  createdAt: '2026-07-29T00:00:00.000Z',
  event: { type: 'user_message', text },
})

const WORKER = {
  id: 7,
  name: 'mac-mini',
  hostname: 'mini.local',
  providerId: 3,
  providerLabel: 'GLM',
  providerKind: 'claude',
}

const ASSIGNMENT = {
  providerId: 3,
  worker: { id: 7, name: 'mac-mini', hostname: 'mini.local', online: true },
}

beforeEach(() => {
  vi.mocked(del).mockReset()
  vi.mocked(get).mockReset()
  vi.mocked(patch).mockReset()
  vi.mocked(post).mockReset()
  TestEventSource.instances.length = 0
})

afterEach(() => vi.unstubAllGlobals())

describe('a draft conversation', () => {
  it('persists the conversation and its first message in one request', async () => {
    vi.mocked(get).mockResolvedValue({ items: [WORKER] })
    vi.mocked(post).mockResolvedValue({ cid: 'abc123' })
    const created = vi.fn()
    const { result } = renderHook(() => useConversation('leave-request', 'new', created))

    await waitFor(() => expect(result.current.selectedWorkerId).toBe(7))
    await act(() => result.current.send('第一条消息', ['file123']))

    expect(post).toHaveBeenCalledWith('/apps/leave-request/conversations', {
      text: '第一条消息',
      attachmentFids: ['file123'],
      workerId: 7,
    })
    expect(created).toHaveBeenCalledWith('abc123')
  })
})

describe('a persisted conversation', () => {
  it('keeps withdrawn and materialized input out of the queue', async () => {
    vi.stubGlobal('EventSource', TestEventSource)
    vi.mocked(get)
      .mockResolvedValueOnce({ items: [WORKER] })
      .mockResolvedValueOnce({
        items: [said(1, 10, 'Hello')],
        pending: [
          { id: 7, text: 'hello', attachments: [], createdAt: '2026-07-29T00:01:00.000Z' },
          {
            id: 8,
            text: 'Are you OK',
            attachments: [],
            createdAt: '2026-07-29T00:02:00.000Z',
          },
        ],
        execution: { state: 'running' },
        assignment: ASSIGNMENT,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 2,
            sequence: 0,
            createdAt: '2026-07-29T00:00:00.000Z',
            event: { type: 'turn.completed' },
          },
        ],
        pending: [],
        execution: { state: 'running' },
        assignment: ASSIGNMENT,
      })
      .mockResolvedValueOnce({
        items: [],
        pending: [],
        execution: { state: 'running' },
        assignment: ASSIGNMENT,
      })

    const { result } = renderHook(() => useConversation('leave-request', 'conversation-1', vi.fn()))

    await waitFor(() => expect(result.current.pending).toHaveLength(2))
    await act(() => result.current.loadOlder())
    expect(result.current.phase).toBe('thinking')

    vi.mocked(del).mockResolvedValue({ cancelled: true })

    await act(() => result.current.withdraw(7))

    expect(del).toHaveBeenCalledWith('/apps/leave-request/conversations/conversation-1/pending/7')
    expect(result.current.pending.map(item => item.id)).toEqual([8])

    act(() => TestEventSource.instances[0]?.emit(said(3, 11, 'Are you OK')))

    await waitFor(() => {
      expect(result.current.bubbles).toContainEqual({
        kind: 'them',
        key: 'seq:11',
        text: 'Are you OK',
      })
      expect(result.current.pending).toEqual([])
    })
  })

  it('keeps queue state separate from stream reconnection', async () => {
    vi.stubGlobal('EventSource', TestEventSource)
    vi.mocked(get)
      .mockResolvedValueOnce({ items: [WORKER] })
      .mockResolvedValue({
        items: [],
        pending: [],
        execution: { state: 'queued' },
        assignment: ASSIGNMENT,
      })

    const { result } = renderHook(() => useConversation('leave-request', 'conversation-1', vi.fn()))

    await waitFor(() => expect(result.current.phase).toBe('queued'))
    expect(result.current.connection).toBe('connecting')

    act(() => TestEventSource.instances[0]?.open())
    expect(result.current.connection).toBe('open')

    act(() => TestEventSource.instances[0]?.fail())
    expect(result.current.connection).toBe('reconnecting')
    expect(result.current.phase).toBe('queued')
  })

  it('retries after the transcript fails to load', async () => {
    vi.stubGlobal('EventSource', TestEventSource)
    vi.mocked(get)
      .mockResolvedValueOnce({ items: [WORKER] })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        items: [],
        pending: [],
        execution: { state: 'idle' },
        assignment: ASSIGNMENT,
      })

    const { result } = renderHook(() => useConversation('leave-request', 'conversation-1', vi.fn()))

    await waitFor(() => expect(result.current.connection).toBe('error'))
    act(() => result.current.retryConnection())
    await waitFor(() => expect(TestEventSource.instances).toHaveLength(2))

    act(() => TestEventSource.instances[1]?.open())
    await waitFor(() => expect(result.current.connection).toBe('open'))
  })
})
