import { ArrowLeft } from 'lucide-react'
import { ConversationList } from '../../features/conversation/conversation-list'
import type { ConversationScope } from '../../features/conversation/scope'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'

export const ConversationHistory = ({
  scope,
  active,
  onClose,
  onSelect,
}: {
  scope: ConversationScope
  active: string | null
  onClose: () => void
  onSelect: (id: string) => void
}) => {
  const __ = useLocale()
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-10 items-center gap-2 border-border border-b px-2">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={__('common.close')}>
          <ArrowLeft />
        </Button>
        <span className="font-medium text-sm">{__('resource.conversations')}</span>
      </div>
      <ConversationList
        scope={scope}
        conversationId={active}
        onSelect={onSelect}
        showHeading={false}
      />
    </div>
  )
}
