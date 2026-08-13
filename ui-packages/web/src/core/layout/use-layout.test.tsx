import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SharedStoreProvider } from '../store'
import { readLayoutState } from './storage'
import { useStudioChat, useWorkspaceSidebar } from './use-layout'

const LayoutConsumer = () => {
  const [workspace, setWorkspace] = useWorkspaceSidebar()
  const [chat, setChat] = useStudioChat()
  return (
    <>
      <output data-testid="layout">{`${workspace}:${chat}`}</output>
      <button type="button" onClick={() => setWorkspace(true)}>
        workspace
      </button>
      <button type="button" onClick={() => setChat(true)}>
        chat
      </button>
    </>
  )
}

const draw = () =>
  render(
    <SharedStoreProvider initial={readLayoutState()}>
      <LayoutConsumer />
    </SharedStoreProvider>,
  )

describe('layout state adapters', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the workspace sidebar and studio chat independent', async () => {
    draw()
    await act(async () => {
      screen.getByRole('button', { name: 'workspace' }).click()
      screen.getByRole('button', { name: 'chat' }).click()
    })
    expect(screen.getByTestId('layout')).toHaveTextContent('true:true')
    expect(localStorage.getItem('idea.workspace.sidebar-collapsed')).toBe('1')
    expect(localStorage.getItem('idea.studio.chat-collapsed')).toBe('1')
  })
})
