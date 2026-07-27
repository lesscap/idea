import { MessageSquarePlus } from 'lucide-react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'

// Placeholder for the real list, which will group conversations by the app they
// concern. That grouping is the visible form of "a conversation senses its
// context": it knows which app it is about, while belonging to no single
// requirement inside it.
//
// Takes the selection as plain props rather than the shell's Workspace object.
// Importing that type would point a feature back at the shell, and the reason
// this lives under features/ is precisely that the shell composes it, never the
// other way round.
//
// The one live entry exists so the panel can be opened and closed while the
// layout is being checked. It is a draft, not a stored conversation.
const DRAFT = 'draft'

export const ConversationList = ({
  conversationId,
  onSelect,
}: {
  conversationId: string | null
  onSelect: (id: string) => void
}) => {
  const __ = useLocale()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2" data-testid="conversation-list">
      <div className="flex items-center justify-between pt-2 pl-2">
        <span className="font-medium text-muted-foreground text-xs">
          {__('resource.conversations')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          data-testid="conversation-new"
          aria-label={__('shell.newConversation')}
          onClick={() => onSelect(DRAFT)}
        >
          <MessageSquarePlus />
        </Button>
      </div>

      <button
        type="button"
        className={`rounded-md px-2 py-1.5 text-left text-sm ${
          conversationId === DRAFT
            ? 'bg-background font-medium'
            : 'text-muted-foreground hover:bg-background/60'
        }`}
        data-testid="conversation-draft"
        data-active={conversationId === DRAFT}
        onClick={() => onSelect(DRAFT)}
      >
        {__('shell.newConversation')}
      </button>
    </div>
  )
}
