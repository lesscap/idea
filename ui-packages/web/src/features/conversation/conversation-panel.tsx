import { ChevronLeft } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useLocale } from '../../i18n'
import { Button, Markdown } from '../../ui'
import { groupActivity, isActivityGroup, type StreamItem } from './activity'
import { ActivityBlock, Step } from './activity-group'
import { Composer } from './composer'
import { useConversation } from './use-conversation'

// Where the requirement actually gets worked out.
//
// The Shell renders this as a sibling of the main area, so opening, switching
// and closing tabs never unmounts it — a half-typed message survives going to
// read the requirement it is about.

// What the person said, drawn as a record rather than a chat bubble.
//
// Left-aligned on a muted ground, not a saturated block on the right. A
// right-aligned bubble is instant-messaging's language and implies two peers
// trading lines; this is someone dictating what they need while the other side
// works it out. A continuous left-aligned record fits that, and lets a long
// requirement use the full width instead of being squeezed into 85% of it.
const Said = ({ text }: { text: string }) => {
  const __ = useLocale()

  // Split on blank lines: several messages typed while a turn was running are
  // merged by the server with `\n\n` between them, and they were separate
  // thoughts when they were typed.
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim() !== '')

  return (
    <div
      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
      data-testid="bubble-them"
    >
      <span className="mb-1 block select-none font-medium text-muted-foreground text-xs">
        {__('transcript.you')}
      </span>
      <div className="min-w-0">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={index === 0 ? 'whitespace-pre-wrap' : 'mt-2 whitespace-pre-wrap'}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  )
}

const Drawn = ({ item }: { item: StreamItem }) => {
  if (isActivityGroup(item)) return <ActivityBlock group={item} />

  if (item.kind === 'them') return <Said text={item.text} />

  // The answer is what the transcript is for: a little larger and darker than
  // its surroundings, and capped near 70 characters because a line wider than
  // that is tiring to read. No border — a box would make it look like a peer of
  // the process rows rather than the point of them.
  if (item.kind === 'agent')
    return (
      <div className="max-w-[70ch] text-[15px] leading-relaxed" data-testid="bubble-agent">
        <Markdown text={item.text} />
      </div>
    )

  // A lone process step, outside any group: drawn bare, because a summary row
  // reading "1 step · 1 thinking" above a single line is chrome with nothing
  // to show.
  if (item.kind === 'thinking' || item.kind === 'tool') return <Step item={item} />

  if (item.kind === 'error')
    return (
      <p
        className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
        data-testid="bubble-error"
      >
        {item.text}
      </p>
    )

  return (
    <p className="text-muted-foreground text-xs" data-testid="bubble-note">
      {item.text}
    </p>
  )
}

export const ConversationPanel = ({
  slug,
  conversationId,
  hidden,
  onConversationCreated,
  onCollapse,
}: {
  slug: string
  conversationId: string | null
  hidden: boolean
  onConversationCreated: (id: string) => void
  onCollapse: () => void
}) => {
  const __ = useLocale()
  const { bubbles, pending, working, status, hasOlder, loadingOlder, loadOlder, send, withdraw } =
    useConversation(slug, conversationId, onConversationCreated)
  const bottom = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // The scroll height recorded just before a "load earlier" read, consumed by
  // the effect below once the events land.
  const anchor = useRef<number | null>(null)

  const stream = useMemo(() => groupActivity(bubbles, working), [bubbles, working])

  const showOlder = () => {
    anchor.current = scroller.current?.scrollHeight ?? 0
    void loadOlder()
  }

  // The transcript grows at both ends, and the two ends want opposite things.
  //
  // Keyed on the count rather than the content so an answer being revised in
  // place — which is how streaming arrives — does not fight the scroll on every
  // frame. Before paint, because a scroll correction applied after one is
  // exactly the jump it exists to prevent.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change detector, not a value read
  useLayoutEffect(() => {
    const el = scroller.current
    const held = anchor.current
    // Earlier events go in above what is on screen and push it down by precisely
    // the height they add. Giving that back leaves the reader on the line they
    // were reading instead of throwing them forward every time they press.
    if (held !== null && el) {
      anchor.current = null
      el.scrollTop += el.scrollHeight - held
      return
    }
    // Anything else is the conversation growing at the bottom. Follow it.
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [stream.length])

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col border-border border-r bg-background ${
        hidden ? 'invisible' : ''
      }`}
      inert={hidden}
      aria-hidden={hidden}
      data-testid="conversation-column"
      data-conversation-id={conversationId ?? ''}
      data-working={working}
      data-status={status}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-border border-b px-3">
        <span className="truncate font-medium text-sm">
          {conversationId === 'new' ? __('shell.newConversation') : __('resource.conversations')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          data-testid="conversation-collapse"
          aria-label={__('shell.collapseConversation')}
          onClick={onCollapse}
        >
          <ChevronLeft />
        </Button>
      </div>

      {conversationId === null ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-muted-foreground text-sm">
          {__('shell.noConversation')}
        </div>
      ) : (
        <>
          <div
            ref={scroller}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
            data-testid="transcript"
            data-has-older={hasOlder}
          >
            {/* Opening reads a window of the most recent events. This is the way
                back through a long conversation. */}
            {hasOlder && (
              <button
                type="button"
                className="shrink-0 self-center rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted disabled:opacity-60"
                data-testid="conversation-load-earlier"
                disabled={loadingOlder}
                onClick={showOlder}
              >
                {__('shell.loadEarlier')}
              </button>
            )}
            {stream.map(item => (
              <Drawn key={item.key} item={item} />
            ))}
            {/* Only when nothing is on screen yet. Once a group is live it says
                so itself, and two "working" indicators is one too many. */}
            {working && stream.length === 0 && (
              <p className="text-muted-foreground text-xs" data-testid="agent-working">
                {__('shell.thinking')}
              </p>
            )}
            <div ref={bottom} />
          </div>

          <Composer
            key={conversationId}
            pending={pending}
            onSend={send}
            onWithdraw={withdraw}
            exclusiveSubmit={conversationId === 'new'}
          />
        </>
      )}
    </div>
  )
}
