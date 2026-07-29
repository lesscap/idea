import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useWorkspaceUrl } from './use-workspace-url'

const draw = () =>
  renderHook(useWorkspaceUrl, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/?cid=new']}>{children}</MemoryRouter>
    ),
  })

describe('finishing a draft conversation', () => {
  it('replaces the sentinel without reverting a resource change made while sending', () => {
    const { result } = draw()
    const finish = result.current.replaceConversation

    act(() => result.current.open('apps'))
    act(() => finish('42'))

    expect(result.current.url).toMatchObject({ active: 'apps', conversationId: '42' })
  })

  it('does not take over after another conversation was selected', () => {
    const { result } = draw()
    const finish = result.current.replaceConversation

    act(() => result.current.showConversation('7'))
    act(() => finish('42'))

    expect(result.current.url.conversationId).toBe('7')
  })
})
