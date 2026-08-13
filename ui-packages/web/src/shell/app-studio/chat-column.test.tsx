import type { App } from '@idea/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { ChatColumn } from './chat-column'
import { AppStudioContentHeader } from './header'
import type { AppStudioWorkspace } from './url/use-app-studio-url'

vi.mock('../../features/conversation/conversation-panel', () => ({
  ConversationPanel: ({
    hidden,
    onConversationCreated,
  }: {
    hidden: boolean
    onConversationCreated: (id: string) => void
  }) => (
    <section data-testid="conversation-panel" data-hidden={hidden}>
      <input aria-label="draft" defaultValue="unfinished" />
      <button type="button" onClick={() => onConversationCreated('created-1')}>
        create conversation
      </button>
    </section>
  ),
}))

vi.mock('../../features/conversation/conversation-list', () => ({
  ConversationList: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect('history-1')}>
      select history
    </button>
  ),
}))

vi.mock('./app-menu', () => ({ AppMenu: () => <span>App menu</span> }))
vi.mock('../components/account-menu', () => ({ AccountMenu: () => <span>Account menu</span> }))

const app: App = {
  id: 1,
  slug: 'leave-request',
  name: '请假申请',
  description: null,
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const createWorkspace = (): AppStudioWorkspace => ({
  url: {
    slug: app.slug,
    active: 'overview',
    tabs: ['overview'],
    conversationId: 'current',
    extra: [],
  },
  open: vi.fn(),
  close: vi.fn(),
  showConversation: vi.fn(),
  replaceConversation: vi.fn(),
})

const draw = ({
  onConversation = vi.fn(),
  onConversationCreated = vi.fn(),
  onCollapse = vi.fn(),
} = {}) => {
  render(
    <LocaleProvider initial="zh">
      <ChatColumn
        app={app}
        scope={{ type: 'app', appId: app.id }}
        conversationId="current"
        entryError={false}
        onConversation={onConversation}
        onConversationCreated={onConversationCreated}
        onCollapse={onCollapse}
        onOpenFile={vi.fn()}
        onRetry={vi.fn()}
      />
    </LocaleProvider>,
  )
  return { onConversation, onConversationCreated, onCollapse }
}

const openHistory = () => fireEvent.click(screen.getByRole('button', { name: '会话' }))

describe('app studio chat column', () => {
  it('keeps the conversation mounted while history covers it', () => {
    draw()
    const draft = screen.getByRole('textbox', { name: 'draft' })

    openHistory()

    expect(screen.getByTestId('conversation-history-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('conversation-panel')).toHaveAttribute('data-hidden', 'true')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByTestId('conversation-history-overlay')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'draft' })).toBe(draft)
  })

  it('closes history when starting or selecting a conversation', () => {
    const { onConversation } = draw()
    openHistory()
    fireEvent.click(screen.getByRole('button', { name: '新会话' }))
    expect(onConversation).toHaveBeenLastCalledWith('new')
    expect(screen.queryByTestId('conversation-history-overlay')).not.toBeInTheDocument()

    openHistory()
    fireEvent.click(screen.getByRole('button', { name: 'select history' }))
    expect(onConversation).toHaveBeenLastCalledWith('history-1')
    expect(screen.queryByTestId('conversation-history-overlay')).not.toBeInTheDocument()
  })

  it('collapses from the chat header', () => {
    const { onCollapse } = draw()

    fireEvent.click(screen.getByRole('button', { name: '收起会话' }))

    expect(onCollapse).toHaveBeenCalledOnce()
  })

  it('reports a newly created conversation through the replace callback', () => {
    const { onConversation, onConversationCreated } = draw()

    fireEvent.click(screen.getByRole('button', { name: 'create conversation' }))

    expect(onConversationCreated).toHaveBeenCalledWith('created-1')
    expect(onConversation).not.toHaveBeenCalled()
  })
})

describe('app studio content header', () => {
  it('offers chat restoration only while chat is collapsed', () => {
    const onExpandChat = vi.fn()
    const workspace = createWorkspace()
    const view = render(
      <LocaleProvider initial="zh">
        <AppStudioContentHeader workspace={workspace} chatCollapsed onExpandChat={onExpandChat} />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '展开会话' }))
    expect(onExpandChat).toHaveBeenCalledOnce()

    view.rerender(
      <LocaleProvider initial="zh">
        <AppStudioContentHeader
          workspace={workspace}
          chatCollapsed={false}
          onExpandChat={onExpandChat}
        />
      </LocaleProvider>,
    )
    expect(screen.queryByRole('button', { name: '展开会话' })).not.toBeInTheDocument()
  })

  it('uses Dashboard as the persistent route to Overview', () => {
    const workspace = createWorkspace()
    render(
      <LocaleProvider initial="zh">
        <AppStudioContentHeader
          workspace={workspace}
          chatCollapsed={false}
          onExpandChat={vi.fn()}
        />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))

    expect(workspace.open).toHaveBeenCalledWith('overview')
    expect(screen.queryByText('概览')).not.toBeInTheDocument()
  })
})
