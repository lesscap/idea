import { PanelLeftClose } from 'lucide-react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'

// Placeholder. What this slice settles is where it sits and what it survives:
// the Shell renders it as a sibling of the main area, so opening, switching and
// closing tabs never unmounts it. A half-typed message stays half-typed while
// you go and read the requirement it is about.
//
// It is told the active resource (`context`) without belonging to it — the
// conversation senses what you are looking at; it is not owned by it. Which is
// why the panel stays put when the main area changes underneath.
export const ConversationPanel = ({
  conversationId,
  context,
  onCollapse,
}: {
  conversationId: string | null
  context: string | null
  onCollapse: () => void
}) => {
  const __ = useLocale()

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col border-border border-r bg-background"
      data-testid="conversation-column"
      data-conversation-id={conversationId ?? ''}
      data-context={context ?? ''}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-border border-b px-3">
        <span className="truncate font-medium text-sm">
          {conversationId === null ? __('resource.conversations') : __('shell.newConversation')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          data-testid="conversation-collapse"
          aria-label={__('shell.collapseConversation')}
          onClick={onCollapse}
        >
          <PanelLeftClose />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-muted-foreground text-sm">
        {conversationId === null ? __('shell.noConversation') : __('shell.conversationSoon')}
      </div>

      {conversationId !== null && (
        <div className="shrink-0 border-border border-t p-3">
          <div className="rounded-md border border-border px-3 py-2 text-muted-foreground text-sm">
            {__('shell.composerSoon')}
          </div>
        </div>
      )}
    </div>
  )
}
