import type { ConversationSummary, Id, Paged } from '@idea/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { get } from '../../lib/request'

// The conversations in this workspace.
//
// Takes the selection as plain props rather than the shell's Workspace object:
// importing that type would point a feature back at the shell, and the reason
// this lives under features/ is that the shell composes it, not the reverse.

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
  prev: readonly ConversationSummary[],
  next: readonly ConversationSummary[],
): ConversationSummary[] => [...new Map([...prev, ...next].map(item => [item.cid, item])).values()]

type PageInfo = { total: number; page: number; pageSize: number }

// `page: 0` means nothing has been read yet, which is what keeps "load more"
// from appearing before the first answer arrives — and is why `pageSize` needs
// no real value here: the check below stops at the page count. Every later value
// comes from the server, which clamps it.
const UNREAD: PageInfo = { total: 0, page: 0, pageSize: 0 }

export const ConversationList = ({
  appId,
  conversationId,
  onSelect,
}: {
  appId: Id
  conversationId: string | null
  onSelect: (id: string) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [info, setInfo] = useState<PageInfo>(UNREAD)

  const fetchPage = useCallback(
    (page: number) =>
      get<Paged<ConversationSummary>>(`/apps/${appId}/conversations?page=${page}`)
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
    [appId],
  )

  // The first page, once. `fetchPage` is stable, so this does not re-run when
  // the selection changes — including when the selection is the local `new`
  // sentinel, which is not a row here but does not stop the list having rows.
  useEffect(() => {
    setItems([])
    setInfo(UNREAD)
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
  const formatActivity = (iso: string) => {
    const date = new Date(iso)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const language = locale === 'zh' ? 'zh-CN' : 'en-GB'

    if (date >= today)
      return new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    if (date >= yesterday) return __('shell.yesterday')
    return new Intl.DateTimeFormat(language, {
      ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
      month: 'numeric',
      day: 'numeric',
    }).format(date)
  }

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
            key={item.cid}
            type="button"
            className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
              conversationId === item.cid
                ? 'bg-muted font-medium text-foreground'
                : 'text-foreground/80 hover:bg-muted/60'
            }`}
            data-testid={`conversation-${item.cid}`}
            data-active={conversationId === item.cid}
            onClick={() => onSelect(item.cid)}
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {item.title ?? `${__('shell.newConversation')} #${item.cid.slice(0, 6)}`}
            </span>
            <time
              className="shrink-0 text-muted-foreground text-xs tabular-nums"
              dateTime={item.lastActiveAt}
            >
              {formatActivity(item.lastActiveAt)}
            </time>
          </button>
        ))}

        {hasMore && (
          <button
            type="button"
            className="w-full rounded-md px-2 py-2 text-center text-muted-foreground text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
