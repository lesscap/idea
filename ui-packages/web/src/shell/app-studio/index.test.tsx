import type { App } from '@idea/shared'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { AppStudioShell } from '.'

const app: App = {
  id: 2,
  slug: 'leave-request',
  name: 'Leave request',
  description: null,
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

vi.mock('../../features/app/api', () => ({ getAppBySlug: vi.fn(async () => app) }))
vi.mock('../../features/conversation/api', () => ({ latestConversation: vi.fn() }))
vi.mock('../../core/layout/use-layout', async () => {
  const { useState } = await import('react')
  return { useStudioChat: () => useState(false) }
})
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: ReactNode }) => children,
  Panel: ({ children }: { children: ReactNode }) => children,
  Separator: () => null,
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChanged: vi.fn() }),
  usePanelCallbackRef: () => [null, vi.fn()],
}))
vi.mock('./url/use-app-studio-url', () => ({
  useAppStudioUrl: () => ({
    url: {
      slug: app.slug,
      active: 'overview',
      tabs: ['overview'],
      conversationId: 'current',
      extra: [],
    },
    open: vi.fn(),
    replace: vi.fn(),
    close: vi.fn(),
    showConversation: vi.fn(),
    replaceConversation: vi.fn(),
  }),
}))
vi.mock('./chat-column', () => ({
  ChatColumn: ({ onCollapse }: { onCollapse: () => void }) => (
    <section>
      <button type="button" onClick={onCollapse}>
        Collapse chat
      </button>
    </section>
  ),
}))
vi.mock('./header', () => ({
  AppStudioContentHeader: ({ onExpandChat }: { onExpandChat: () => void }) => (
    <button type="button" onClick={onExpandChat}>
      Expand chat
    </button>
  ),
}))
vi.mock('./resource-nav', () => ({ ResourceNav: () => null }))
vi.mock('./content', () => ({
  ContentColumn: () => <input aria-label="resource draft" defaultValue="unfinished" />,
}))

let mobile = false
const mediaListeners = new Set<() => void>()

beforeAll(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      get matches() {
        return mobile
      },
      addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        mediaListeners.delete(listener),
    })),
  })
})

beforeEach(() => {
  mobile = false
  mediaListeners.clear()
})

describe('app studio mobile layout', () => {
  it('preserves resource state across responsive and panel changes', async () => {
    render(
      <LocaleProvider initial="en">
        <AppStudioShell />
      </LocaleProvider>,
    )

    const draft = await screen.findByRole('textbox', { name: 'resource draft' })
    fireEvent.change(draft, { target: { value: 'kept draft' } })

    act(() => {
      mobile = true
      mediaListeners.forEach(listener => {
        listener()
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat' }))
    expect(screen.getByRole('textbox', { name: 'resource draft' })).toBe(draft)
    expect(draft).toHaveValue('kept draft')

    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat' }))

    expect(screen.getByRole('textbox', { name: 'resource draft' })).toBe(draft)
    expect(draft).toHaveValue('kept draft')
  })
})
