import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from '../../lib/request'
import { useConversation } from './use-conversation'

vi.mock('../../lib/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

describe('a draft conversation', () => {
  beforeEach(() => vi.mocked(post).mockReset())

  it('persists the conversation and its first message in one request', async () => {
    vi.mocked(post).mockResolvedValue({ id: 42 })
    const created = vi.fn()
    const { result } = renderHook(() => useConversation('new', created))

    await act(() => result.current.send('第一条消息'))

    expect(post).toHaveBeenCalledWith('/conversations', { text: '第一条消息' })
    expect(created).toHaveBeenCalledWith('42')
  })
})
