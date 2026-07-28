import { ArrowUp, X } from 'lucide-react'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import type { PendingInput } from './use-conversation'

// Where someone says what they want.
//
// One card is the whole control. The textarea has no border and no ground of its
// own, the queued messages sit above it, and the arrow sits inside — so the
// bottom of the panel is a single object rather than a box, a button and two
// horizontal rules stacked in a corner.
//
// Shape taken from baton's composer (`channel-room/composer.tsx`), minus the
// parts we have no mechanism for yet: attachments, slash commands, plan mode.

const MIN = '2.5rem'
const MAX_PX = 160

// Grow with the content up to a ceiling, then scroll inside. This must finish
// before paint: an ordinary effect would draw the previous height for one frame
// after every input, visibly moving the composer and transcript.
const useAutosize = (ref: RefObject<HTMLTextAreaElement | null>, value: string) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the trigger; the effect reads the DOM, not the prop
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Reset first: scrollHeight only shrinks back if the element is not already
    // holding the taller height open.
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_PX)}px`
  }, [ref, value])
}

export const Composer = ({
  pending,
  onSend,
  onWithdraw,
}: {
  pending: readonly PendingInput[]
  onSend: (text: string) => Promise<unknown>
  onWithdraw: (id: number) => Promise<unknown>
}) => {
  const __ = useLocale()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutosize(ref, draft)

  const canSend = draft.trim() !== '' && !sending

  const submit = () => {
    const text = draft.trim()
    if (!text || sending) return
    // Cleared immediately. Waiting for the round trip makes the interface feel
    // like it missed the keystroke; restored if the send actually failed.
    setDraft('')
    setSending(true)
    void onSend(text)
      .catch(() => setDraft(text))
      .finally(() => setSending(false))
  }

  return (
    <div className="shrink-0 border-border border-t px-3 py-2.5">
      <div className="rounded-xl border border-border transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        {/* Typed and queued, but not answered yet. Inside the card because it is
            the same act as the text below it — everything here is about to be
            said, and until it is, it can be taken back. */}
        {pending.length > 0 && (
          <div className="space-y-0.5 px-3 pt-2 pb-1" data-testid="pending-list">
            {pending.map(item => (
              <div
                key={item.id}
                // Darker than the placeholder below it. Both are muted grey at
                // the same size otherwise, and a queued line then reads as a
                // second line of the hint rather than as something said.
                className="flex items-start gap-2 text-foreground/75 text-sm"
                data-testid={`pending-${item.id}`}
              >
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
                <button
                  type="button"
                  className="shrink-0 hover:text-foreground [&_svg]:size-3.5"
                  aria-label={__('shell.withdraw')}
                  data-testid={`pending-withdraw-${item.id}`}
                  onClick={() => void onWithdraw(item.id)}
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={ref}
            rows={1}
            style={{ minHeight: MIN }}
            className="flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            placeholder={__('shell.composerPlaceholder')}
            data-testid="composer"
            value={draft}
            disabled={sending}
            onChange={event => setDraft(event.target.value)}
            // Sending while a turn is running is allowed on purpose: the server
            // holds it and merges it with whatever else arrives before that turn
            // ends, so a thought delivered in pieces gets one reply.
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.shiftKey) return
              // Enter also confirms a candidate in an IME. Sending here would
              // ship half a pinyin string — and this interface is Chinese first,
              // so that is the common path, not an edge case.
              if (event.nativeEvent.isComposing) return
              event.preventDefault()
              submit()
            }}
          />
          {/* Colour follows whether there is anything to send, so the one
              saturated element in the panel is never idle. Disabled goes
              neutral rather than the default half-opacity, which on a coloured
              button is still the accent, only weaker. */}
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label={__('shell.send')}
            data-testid="composer-send"
            disabled={!canSend}
            onClick={submit}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </div>
  )
}
