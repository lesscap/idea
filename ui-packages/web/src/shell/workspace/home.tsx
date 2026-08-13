import { useNavigate } from 'react-router-dom'
import { ConversationPanel } from '../../features/conversation/conversation-panel'
import type { ConversationScope } from '../../features/conversation/scope'
import { useLocale } from '../../i18n'

const WORKSPACE_SCOPE: ConversationScope = { type: 'workspace' }

export const WorkspaceHome = () => {
  const __ = useLocale()
  const navigate = useNavigate()

  return (
    <main
      className="grid min-h-0 flex-1 place-items-center overflow-auto bg-canvas"
      data-testid="workspace-home"
    >
      <div className="w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-7 text-center">
          <h1 className="text-balance font-semibold text-2xl tracking-[-0.03em] sm:text-3xl">
            {__('shell.workspaceGreeting')}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">{__('shell.workspacePrompt')}</p>
        </div>
        <ConversationPanel
          scope={WORKSPACE_SCOPE}
          conversationId="new"
          hidden={false}
          presentation="launcher"
          showHeader={false}
          onConversationCreated={id =>
            navigate(`/conversations/${encodeURIComponent(id)}`, { replace: true })
          }
          onCollapse={() => undefined}
          onOpenFile={file =>
            window.open(
              `/api/web/files/${encodeURIComponent(file.fid)}`,
              '_blank',
              'noopener,noreferrer',
            )
          }
        />
      </div>
    </main>
  )
}
