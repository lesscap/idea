import { useNavigate, useParams } from 'react-router-dom'
import { ConversationPanel } from '../../features/conversation/conversation-panel'
import type { ConversationScope } from '../../features/conversation/scope'

const WORKSPACE_SCOPE: ConversationScope = { type: 'workspace' }

export const WorkspaceConversationPage = () => {
  const { cid = 'new' } = useParams()
  const navigate = useNavigate()
  return (
    <main className="flex min-h-0 flex-1 bg-background">
      <ConversationPanel
        scope={WORKSPACE_SCOPE}
        conversationId={cid}
        hidden={false}
        onConversationCreated={id =>
          navigate(`/conversations/${encodeURIComponent(id)}`, { replace: true })
        }
        onCollapse={() => navigate('/')}
        onOpenFile={file =>
          window.open(
            `/api/web/files/${encodeURIComponent(file.fid)}`,
            '_blank',
            'noopener,noreferrer',
          )
        }
      />
    </main>
  )
}
