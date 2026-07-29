import type { Paged } from '@idea/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { get } from '../../lib/request'

// The conversations in this workspace.
//
// Takes the selection as plain props rather than the shell's Workspace object:
// importing that type would point a feature back at the shell, and the reason
// this lives under features/ is that the shell composes it, not the reverse.

type Summary = { id: number; title: string | null; lastActiveAt: string }

// Appends a page without letting a row arrive twice.
//
// The list is ordered by lastActiveAt, and saying anything moves a conversation
// to the front — so one that sat on page 2 when page 1 was read can be on page 1
// by the time "load more" asks for page 2, and comes back a second time.
//
// Map's constructor keeps the position of a key's first appearance while taking
// its last value, which is what this wants: the row stays where the reader
// already saw it, holding whatever is newer.
export const mergeConversations = (
  prev: readonly Summary[],
  next: readonly Summary[],
): Summary[] => [...new Map([...prev, ...next].map(item => [item.id, item])).values()]

type PageInfo = { total: number; page: number; pageSize: number }

// `page: 0` means nothing has been read yet, which is what keeps "load more"
// from appearing before the first answer arrives — and is why `pageSize` needs
// no real value here: the check below stops at the page count. Every later value
// comes from the server, which clamps it.
const UNREAD: PageInfo = { total: 0, page: 0, pageSize: 0 }

export const ConversationList = ({
  conversationId,
  onSelect,
}: {
  conversationId: string | null
  onSelect: (id: string) => void
}) => {
  const __ = useLocale()
  const [items, setItems] = useState<Summary[]>([])
  const [info, setInfo] = useState<PageInfo>(UNREAD)

  const fetchPage = useCallback(
    (page: number) =>
      get<Paged<Summary>>(`/conversations?page=${page}`)
        .then(data => {
          // Page 1 is a re-read and replaces; anything beyond it is "load more"
          // and appends.
          setItems(prev => (page === 1 ? [...data.items] : mergeConversations(prev, data.items)))
          setInfo({ total: data.total, page: data.page, pageSize: data.pageSize })
        })
        .catch(() => {
          // A list that failed to refresh is better left showing what it had
          // than emptied: the selection in the URL still resolves either way.
        }),
    [],
  )

  // The first page, once. `fetchPage` is stable, so this does not re-run when
  // the selection changes — including when the selection is the local `new`
  // sentinel, which is not a row here but does not stop the list having rows.
  useEffect(() => {
    void fetchPage(1)
  }, [fetchPage])

  // A draft becoming real is the only moment a row appears. Selecting some other
  // existing conversation adds nothing, and re-reading there would discard
  // whatever "load more" had already fetched.
  const wasDraft = useRef(conversationId === 'new')
  useEffect(() => {
    if (wasDraft.current && conversationId !== 'new') void fetchPage(1)
    wasDraft.current = conversationId === 'new'
  }, [conversationId, fetchPage])

  // Have the pages read so far covered the total? Counted in pages rather than
  // in rows held, because deduplicating an overlap leaves fewer rows than were
  // fetched — `items.length` would never catch up and the button would stay
  // pressable forever.
  const hasMore = info.page > 0 && info.page * info.pageSize < info.total

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2"
      data-testid="conversation-list"
      data-page={info.page}
      data-total={info.total}
    >
      <div className="flex items-center pt-2 pl-2">
        <span className="font-medium text-muted-foreground text-xs">
          {__('resource.conversations')}
        </span>
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
            {/* The name comes from the conversation itself: the worker
                summarises its first exchange once that exchange exists. Until
                then — and for the few that had too little said to summarise —
                the id is all there is.

                Deliberately not translated. A name is data; the same
                conversation must not be called one thing in Chinese and another
                in English. */}
            {item.title ?? `#${item.id}`}
          </button>
        ))}

        {hasMore && (
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-muted-foreground text-xs hover:bg-background/60"
            data-testid="conversation-load-more"
            onClick={() => void fetchPage(info.page + 1)}
          >
            {__('shell.loadMore')}
          </button>
        )}
      </div>
    </div>
  )
}
