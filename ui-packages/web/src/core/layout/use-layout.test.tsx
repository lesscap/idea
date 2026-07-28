import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SharedStoreProvider } from '../store'
import { readLayoutState } from './storage'
import {
  useConversationCollapsed,
  useSetConversationCollapsed,
  useSideCollapsed,
  useToggleSide,
} from './use-layout'

const LayoutConsumer = () => {
  const sideCollapsed = useSideCollapsed()
  const conversationCollapsed = useConversationCollapsed()
  const toggleSide = useToggleSide()
  const setConversationCollapsed = useSetConversationCollapsed()

  return (
    <>
      <output data-testid="layout">{`${sideCollapsed}:${conversationCollapsed}`}</output>
      <button type="button" onClick={toggleSide}>
        side
      </button>
      <button type="button" onClick={() => setConversationCollapsed(true)}>
        conversation
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

  it('initializes from persisted preferences', () => {
    localStorage.setItem('idea.shell.side-collapsed', '1')
    draw()

    expect(screen.getByTestId('layout')).toHaveTextContent('true:false')
  })

  it('updates shared state and persists the preference', async () => {
    draw()

    await act(async () => {
      screen.getByRole('button', { name: 'side' }).click()
      screen.getByRole('button', { name: 'conversation' }).click()
    })

    expect(screen.getByTestId('layout')).toHaveTextContent('true:true')
    expect(localStorage.getItem('idea.shell.side-collapsed')).toBe('1')
    expect(localStorage.getItem('idea.shell.conversation-collapsed')).toBe('1')
  })
})
