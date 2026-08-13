import type { App } from '@idea/shared'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { ConversationPanel } from '../../features/conversation/conversation-panel'
import type { ConversationScope } from '../../features/conversation/scope'
import type { FileDescriptor } from '../../features/file/api'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { ConversationHistory } from './conversation-history'
import { AppStudioChatHeader } from './header'

export const ChatColumn = ({
  app,
  scope,
  conversationId,
  entryError,
  onConversation,
  onConversationCreated,
  onCollapse,
  onOpenFile,
  onRetry,
}: {
  app: App
  scope: ConversationScope
  conversationId: string | null
  entryError: boolean
  onConversation: (id: string) => void
  onConversationCreated: (id: string) => void
  onCollapse: () => void
  onOpenFile: (file: FileDescriptor) => void
  onRetry: () => void
}) => {
  const __ = useLocale()
  const [history, setHistory] = useState(false)

  const showConversation = (id: string) => {
    onConversation(id)
    setHistory(false)
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      data-testid="studio-chat-column"
    >
      <AppStudioChatHeader
        app={app}
        historyOpen={history}
        onNewConversation={() => showConversation('new')}
        onToggleHistory={() => setHistory(open => !open)}
        onCollapse={onCollapse}
      />
      <div className="relative flex min-h-0 flex-1">
        {conversationId === null ? (
          <div className="grid min-h-0 flex-1 place-items-center">
            {entryError ? (
              <div className="text-center">
                <AlertCircle className="mx-auto size-6 text-destructive" />
                <p className="mt-2 text-sm">{__('shell.conversationLoadFailed')}</p>
                <Button className="mt-3" variant="outline" onClick={onRetry}>
                  {__('common.retry')}
                </Button>
              </div>
            ) : (
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            )}
          </div>
        ) : (
          <ConversationPanel
            scope={scope}
            conversationId={conversationId}
            hidden={history}
            showHeader={false}
            onConversationCreated={onConversationCreated}
            onCollapse={onCollapse}
            onOpenFile={onOpenFile}
          />
        )}
        {history && (
          <div
            className="absolute inset-0 z-10 flex bg-background"
            data-testid="conversation-history-overlay"
          >
            <ConversationHistory
              scope={scope}
              active={conversationId}
              onClose={() => setHistory(false)}
              onSelect={showConversation}
            />
          </div>
        )}
      </div>
    </div>
  )
}
