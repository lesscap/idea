import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useWorkspaceUrl } from './use-workspace-url'

const draw = () =>
  renderHook(
    () => ({
      navigate: useNavigate(),
      workspace: useWorkspaceUrl(),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={['/apps/a/conversation/new']}>{children}</MemoryRouter>
      ),
    },
  )

describe('finishing a draft conversation', () => {
  it('replaces the sentinel without reverting a resource change made while sending', () => {
    const { result } = draw()
    const finish = result.current.workspace.replaceConversation

    act(() => result.current.workspace.open('requirements'))
    act(() => finish('cid123'))

    expect(result.current.workspace.url).toMatchObject({
      slug: 'a',
      active: 'requirements',
      conversationId: 'cid123',
    })
  })

  it('does not take over a new draft opened after leaving the original app', () => {
    const { result } = draw()
    const finish = result.current.workspace.replaceConversation

    act(() => result.current.navigate('/apps/b/conversation/new'))
    act(() => result.current.navigate('/apps/a/conversation/new'))
    act(() => finish('cid123'))

    expect(result.current.workspace.url).toMatchObject({ slug: 'a', conversationId: 'new' })
  })
})
