import { MessageSquarePlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { get, post } from '../../lib/request'
import { Button } from '../../ui'

// The conversations in this workspace.
//
// Takes the selection as plain props rather than the shell's Workspace object:
// importing that type would point a feature back at the shell, and the reason
// this lives under features/ is that the shell composes it, not the reverse.

type Summary = { id: number; title: string | null; lastActiveAt: string }

export const ConversationList = ({
  conversationId,
  onSelect,
}: {
  conversationId: string | null
  onSelect: (id: string) => void
}) => {
  const __ = useLocale()
  const [items, setItems] = useState<Summary[]>([])

  // Stable, so the effect below runs once rather than on every render.
  const load = useCallback(
    () =>
      get<{ items: Summary[] }>('/conversations')
        .then(data => setItems(data.items))
        .catch(() => setItems([])),
    [],
  )

  // Read once on mount, and again explicitly after creating one — enough to
  // keep the list current without polling it.
  useEffect(() => {
    void load()
  }, [load])

  const start = async () => {
    const created = await post<{ id: number }>('/conversations', {})
    await load()
    onSelect(String(created.id))
  }

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
          onClick={() => void start()}
        >
          <MessageSquarePlus />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
              conversationId === String(item.id)
                ? 'bg-background font-medium'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
            data-testid={`conversation-${item.id}`}
            data-active={conversationId === String(item.id)}
            onClick={() => onSelect(String(item.id))}
          >
            {/* Until a conversation is named, its first line is the only thing
                that distinguishes it — and naming it automatically is a separate
                job that needs the transcript. */}
            {item.title ?? `${__('shell.newConversation')} #${item.id}`}
          </button>
        ))}
      </div>
    </div>
  )
}
