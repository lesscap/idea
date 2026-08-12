import type { AgentEffort, UploadedFile } from '@idea/shared'
import { ArrowUp, Clock3, Square, X } from 'lucide-react'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import {
  ComposerAttachmentButton,
  ComposerAttachmentTray,
  useComposerAttachments,
} from './composer-attachments'
import { parseModelCommand } from './model-command'
import { ModelControl } from './model-control'
import type { ModelConfiguration, PendingInput } from './use-conversation'
import { useModelCommand } from './use-model-command'

// Where someone says what they want.
//
// The queued messages sit above the input surface. The textarea and arrow remain
// one control, while queue changes do not resize its border.
//
// Shape taken from baton's composer (`channel-room/composer.tsx`), minus the
// parts we have no mechanism for yet: slash commands and plan mode.

const MIN = '2.75rem'
const MAX_PX = 192

type Withdrawal = { id: number; status: 'pending' | 'failed' } | null

const resize = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_PX)}px`
}

// Grow with the content up to a ceiling, then scroll inside. This must finish
// before paint: an ordinary effect would draw the previous height for one frame
// after every input, visibly moving the composer and transcript.
const useAutosize = (ref: RefObject<HTMLTextAreaElement | null>, value: string) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the trigger; the effect reads the DOM, not the prop
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    resize(el)
  }, [ref, value])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      const nextWidth = el.clientWidth
      if (nextWidth === width) return
      width = nextWidth
      resize(el)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}

export const Composer = ({
  pending,
  onSend,
  onUpload,
  onOpenFile,
  onWithdraw,
  running,
  stopping,
  stopFailed,
  onStop,
  exclusiveSubmit,
  disabled,
  modelConfiguration,
  onConfigureModel,
}: {
  pending: readonly PendingInput[]
  onSend: (text: string, attachmentFids: readonly string[]) => Promise<unknown>
  onUpload: (file: File) => Promise<UploadedFile>
  onOpenFile: (file: UploadedFile) => void
  onWithdraw: (id: number) => Promise<unknown>
  running: boolean
  stopping: boolean
  stopFailed: boolean
  onStop: () => Promise<void>
  exclusiveSubmit: boolean
  disabled: boolean
  modelConfiguration: ModelConfiguration
  onConfigureModel: (model: string | null, effort: AgentEffort | null) => Promise<unknown>
}) => {
  const __ = useLocale()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const [commandFailed, setCommandFailed] = useState(false)
  const [withdrawal, setWithdrawal] = useState<Withdrawal>(null)
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const submittingRef = useRef(false)
  const attachments = useComposerAttachments(onUpload)
  useAutosize(ref, draft)

  const configure = async (model: string | null, effort: AgentEffort | null) => {
    if (submittingRef.current) return
    const commandDraft = draft.trim().startsWith('/model') ? draft : ''
    setCommandFailed(false)
    submittingRef.current = true
    setSubmitting(true)
    if (commandDraft) setDraft('')
    try {
      await onConfigureModel(model, effort)
    } catch {
      if (commandDraft) setDraft(current => current || commandDraft)
      setCommandFailed(true)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }
  const command = useModelCommand(
    draft,
    [...new Set([modelConfiguration.defaultModel, ...modelConfiguration.models])].filter(
      (model): model is string => model !== null,
    ),
    model => {
      void configure(model, null)
    },
  )

  const canSend =
    !disabled && !attachments.unsettled && (draft.trim() !== '' || attachments.ready.length > 0)

  const submit = () => {
    const text = draft.trim()
    if (!canSend || submittingRef.current) return
    const parsed = parseModelCommand(text)
    if (parsed?.kind === 'invalid') {
      setCommandFailed(true)
      return
    }
    if (parsed?.kind === 'reset') return void configure(null, null)
    if (parsed?.kind === 'apply') return void configure(parsed.model, parsed.effort)
    const attachmentFids = attachments.ready.map(file => file.fid)
    setSendFailed(false)

    submittingRef.current = true
    setSubmitting(true)

    // Cleared immediately. Waiting for the round trip makes the interface feel
    // like it missed the keystroke; restored if the send actually failed.
    setDraft('')
    void onSend(text, attachmentFids)
      .then(() => attachments.removeUploaded(attachmentFids))
      .catch(() => {
        setDraft(current => (text ? (current ? `${text}\n\n${current}` : text) : current))
        setSendFailed(true)
      })
      .finally(() => {
        submittingRef.current = false
        setSubmitting(false)
      })
  }

  const withdraw = async (id: number) => {
    setWithdrawal({ id, status: 'pending' })
    try {
      await onWithdraw(id)
      setWithdrawal(null)
    } catch {
      setWithdrawal({ id, status: 'failed' })
    }
  }

  return (
    <div className="shrink-0 border-border border-t px-3 py-2.5">
      {pending.length > 0 && (
        <section
          className="mb-2 rounded-lg bg-muted/50 p-2"
          data-testid="pending-list"
          aria-label={__('shell.queued', pending.length)}
        >
          <div className="flex items-center gap-1.5 px-1 font-medium text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            <span>{__('shell.queued', pending.length)}</span>
          </div>
          <div className="mt-1 space-y-0.5">
            {pending.map(item => (
              <div
                key={item.id}
                className="flex min-h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-muted"
                data-testid={`pending-${item.id}`}
              >
                <div className="min-w-0 flex-1">
                  {item.text && (
                    <span className="block truncate text-foreground/80">{item.text}</span>
                  )}
                  {item.attachments.length > 0 && (
                    <span className="block truncate text-muted-foreground text-xs">
                      {item.attachments.map(file => file.filename).join(', ')}
                    </span>
                  )}
                  {withdrawal?.id === item.id && withdrawal.status === 'failed' && (
                    <span className="block text-destructive text-xs" role="status">
                      {__('shell.withdrawQueuedFailed')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
                  aria-label={__('shell.withdrawQueued')}
                  data-testid={`pending-withdraw-${item.id}`}
                  disabled={withdrawal?.status === 'pending'}
                  onClick={() => void withdraw(item.id)}
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {sendFailed && (
        <p className="mb-2 px-1 text-destructive text-xs" role="alert">
          {__('transcript.status.sendFailed')}
        </p>
      )}
      {commandFailed && (
        <p className="mb-2 px-1 text-destructive text-xs" role="alert">
          {__('shell.model.invalid')}
        </p>
      )}
      {stopFailed && (
        <p className="mb-2 px-1 text-destructive text-xs" role="alert">
          {__('transcript.status.stopFailed')}
        </p>
      )}

      <fieldset
        disabled={disabled || (exclusiveSubmit && submitting)}
        className={`min-w-0 rounded-xl border transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 ${
          dragging ? 'border-ring bg-muted/20' : 'border-border'
        } ${disabled ? 'bg-muted/20 opacity-70' : ''}`}
        onDragEnter={event => {
          event.preventDefault()
          if (disabled) return
          setDragging(true)
        }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          )
            return
          setDragging(false)
        }}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          if (disabled) return
          attachments.add(event.dataTransfer.files)
        }}
      >
        {command.suggestions.length > 0 && (
          <div className="border-border border-b p-1" role="listbox">
            {command.suggestions.map((suggestion, index) => (
              <button
                key={suggestion.label}
                type="button"
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  command.active === index ? 'bg-muted' : ''
                }`}
                role="option"
                aria-selected={command.active === index}
                onMouseDown={event => event.preventDefault()}
                onClick={() => void configure(suggestion.model, null)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
        <ComposerAttachmentTray state={attachments} onOpen={onOpenFile} />
        <textarea
          ref={ref}
          rows={1}
          style={{ minHeight: MIN }}
          className="block w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          placeholder={__('shell.composerPlaceholder')}
          data-testid="composer"
          value={draft}
          onChange={event => {
            setDraft(event.target.value)
            setSendFailed(false)
            setCommandFailed(false)
          }}
          onPaste={event => {
            if (event.clipboardData.files.length === 0) return
            event.preventDefault()
            attachments.add(event.clipboardData.files)
          }}
          // Sending while a turn is running is allowed on purpose: the server
          // holds it and merges it with whatever else arrives before that turn
          // ends, so a thought delivered in pieces gets one reply.
          onKeyDown={event => {
            if (command.onKeyDown(event)) return
            if (event.key !== 'Enter' || event.shiftKey) return
            // Enter also confirms a candidate in an IME. Sending here would
            // ship half a pinyin string — and this interface is Chinese first,
            // so that is the common path, not an edge case.
            if (event.nativeEvent.isComposing) return
            event.preventDefault()
            submit()
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            <ComposerAttachmentButton state={attachments} />
            <ModelControl
              configuration={modelConfiguration}
              disabled={disabled || submitting}
              onChange={configure}
            />
          </div>
          {/* Colour follows whether there is anything to send, so the one
              saturated element in the panel is never idle. Disabled goes
              neutral rather than the default half-opacity, which on a coloured
              button is still the accent, only weaker. */}
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shrink-0 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label={stopping ? __('shell.stopping') : __('shell.stop')}
            data-testid="composer-stop"
            hidden={!running}
            disabled={stopping}
            onClick={() => void onStop()}
          >
            <Square className="fill-current" />
          </Button>
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label={__('shell.send')}
            data-testid="composer-send"
            hidden={running}
            disabled={!canSend || submitting}
            onClick={submit}
          >
            <ArrowUp />
          </Button>
        </div>
      </fieldset>
    </div>
  )
}
