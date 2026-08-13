import type { App } from '@idea/shared'
import { History, PanelLeft, SquarePen } from 'lucide-react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { AccountMenu } from '../components/account-menu'
import { BrandMark } from '../components/brand-mark'
import { AppMenu } from './app-menu'
import { TabBar } from './content/tab-bar'
import type { AppStudioWorkspace } from './url/use-app-studio-url'

const headerClassName = 'flex h-11 shrink-0 items-center gap-2 border-border border-b bg-shell px-3'

export const AppStudioChatHeader = ({
  app,
  historyOpen,
  onNewConversation,
  onToggleHistory,
  onCollapse,
}: {
  app: App
  historyOpen: boolean
  onNewConversation: () => void
  onToggleHistory: () => void
  onCollapse: () => void
}) => {
  const __ = useLocale()
  return (
    <header className={headerClassName} data-testid="studio-chat-header">
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark compact />
        <span className="h-5 w-px bg-border" />
        <AppMenu current={app} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={onNewConversation}
          aria-label={__('shell.newConversation')}
        >
          <SquarePen />
          <span className="hidden xl:inline">{__('shell.newConversation')}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleHistory}
          aria-label={__('resource.conversations')}
          aria-pressed={historyOpen}
        >
          <History />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          aria-label={__('shell.collapseConversation')}
        >
          <PanelLeft />
        </Button>
      </div>
    </header>
  )
}

export const AppStudioContentHeader = ({
  workspace,
  chatCollapsed,
  onExpandChat,
}: {
  workspace: AppStudioWorkspace
  chatCollapsed: boolean
  onExpandChat: () => void
}) => {
  const __ = useLocale()
  return (
    <header className={headerClassName} data-testid="studio-content-header">
      {chatCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onExpandChat}
          aria-label={__('shell.expandConversation')}
        >
          <PanelLeft />
        </Button>
      )}
      <button
        type="button"
        className="h-8 shrink-0 rounded-md border border-border bg-nav-active px-3 font-medium text-sm outline-none hover:bg-nav-hover focus-visible:ring-2 focus-visible:ring-ring"
        aria-pressed="true"
        onClick={() => workspace.open('overview')}
      >
        {__('shell.dashboard')}
      </button>
      <div className="flex min-w-0 flex-1 self-stretch">
        <TabBar workspace={workspace} />
      </div>
      <div className="shrink-0">
        <AccountMenu compact placement="header" />
      </div>
    </header>
  )
}
