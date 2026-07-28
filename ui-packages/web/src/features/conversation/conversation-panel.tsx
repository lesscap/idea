import { PanelLeftClose, Send, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Markdown } from '../../ui'
import { groupActivity, isActivityGroup, type StreamItem } from './activity'
import { ActivityBlock, Step } from './activity-group'
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
      <span className="mr-2 select-none font-mono text-[11px] text-muted-foreground">
        {__('transcript.you')}›
      </span>
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph}
          className={index === 0 ? 'inline whitespace-pre-wrap' : 'mt-2 whitespace-pre-wrap'}
        >
          {paragraph}
        </p>
      ))}
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
  conversationId,
  context,
  onCollapse,
}: {
  conversationId: string | null
  context: string | null
  onCollapse: () => void
}) => {
  const __ = useLocale()
  const { bubbles, pending, working, status, send, withdraw } = useConversation(conversationId)
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const stream = useMemo(() => groupActivity(bubbles, working), [bubbles, working])

  // Follows the conversation as it grows. Keyed on the count rather than the
  // content so an answer being revised in place — which is how streaming
  // arrives — does not fight the scroll on every frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change detector, not a value read
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [stream.length])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    // Cleared immediately. Waiting for the round trip makes the interface feel
    // like it missed the keystroke; restored if the send actually failed.
    setDraft('')
    void send(text).catch(() => setDraft(text))
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col border-border border-r bg-background"
      data-testid="conversation-column"
      data-conversation-id={conversationId ?? ''}
      data-context={context ?? ''}
      data-working={working}
      data-status={status}
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

      {conversationId === null ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-muted-foreground text-sm">
          {__('shell.noConversation')}
        </div>
      ) : (
        <>
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
            data-testid="transcript"
          >
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

          {/* Typed but not sent. Shown apart from the transcript because it has
              not happened yet — and because until it does, it can be taken back. */}
          {pending.length > 0 && (
            <div className="shrink-0 border-border border-t px-3 py-2" data-testid="pending-list">
              {pending.map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 text-muted-foreground text-sm"
                  data-testid={`pending-${item.id}`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.text}</span>
                  <button
                    type="button"
                    className="shrink-0 hover:text-foreground [&_svg]:size-3.5"
                    aria-label={__('shell.withdraw')}
                    data-testid={`pending-withdraw-${item.id}`}
                    onClick={() => void withdraw(item.id)}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex shrink-0 items-end gap-2 border-border border-t p-3">
            <textarea
              className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={1}
              placeholder={__('shell.composerPlaceholder')}
              data-testid="composer"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              // Sending while a turn is running is allowed on purpose: the
              // server holds it and merges it with whatever else arrives before
              // that turn ends, so a thought delivered in pieces gets one reply.
              onKeyDown={event => {
                if (event.key !== 'Enter' || event.shiftKey) return
                event.preventDefault()
                submit()
              }}
            />
            <Button size="sm" data-testid="composer-send" disabled={!draft.trim()} onClick={submit}>
              <Send />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
