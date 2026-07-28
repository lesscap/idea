import { ChevronRight, PanelLeftClose, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Markdown } from '../../ui'
import type { Bubble } from './transcript'
import { useConversation } from './use-conversation'

// Where the requirement actually gets worked out.
//
// The Shell renders this as a sibling of the main area, so opening, switching
// and closing tabs never unmounts it — a half-typed message survives going to
// read the requirement it is about.

const Reasoning = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false)

  // Folded by default. Someone describing what they need wants the answer; the
  // working-out is for when the answer looks wrong.
  return (
    <div className="text-muted-foreground text-xs" data-testid="bubble-thinking">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground [&_svg]:size-3"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={open ? 'rotate-90' : ''} />
        {text.length} 字
      </button>
      {open && <p className="mt-1 whitespace-pre-wrap pl-4 leading-relaxed">{text}</p>}
    </div>
  )
}

const Drawn = ({ bubble }: { bubble: Bubble }) => {
  if (bubble.kind === 'them')
    return (
      <div className="flex justify-end" data-testid="bubble-them">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm">
          {bubble.text}
        </p>
      </div>
    )

  if (bubble.kind === 'agent')
    return (
      <div className="text-sm leading-relaxed" data-testid="bubble-agent">
        <Markdown text={bubble.text} />
      </div>
    )

  if (bubble.kind === 'thinking') return <Reasoning text={bubble.text} />

  if (bubble.kind === 'tool')
    return (
      <p className="text-muted-foreground text-xs" data-testid="bubble-tool">
        {bubble.name}
        {bubble.running ? ' …' : bubble.failed ? ' ✗' : ' ✓'}
      </p>
    )

  if (bubble.kind === 'error')
    return (
      <p
        className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
        data-testid="bubble-error"
      >
        {bubble.text}
      </p>
    )

  return (
    <p className="text-muted-foreground text-xs" data-testid="bubble-note">
      {bubble.text}
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

  // Follows the conversation as it grows. Keyed on the count rather than the
  // content so an answer being revised in place — which is how streaming
  // arrives — does not fight the scroll on every frame.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles.length])

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
            {bubbles.map(bubble => (
              <Drawn key={bubble.key} bubble={bubble} />
            ))}
            {working && (
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
