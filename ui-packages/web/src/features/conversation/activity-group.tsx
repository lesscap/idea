import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useLocale } from '../../i18n'
import { cn } from '../../lib/cn'
import {
  type ActivityGroup,
  type NodeTone,
  type ProcessBubble,
  previewOf,
  summarise,
  toneOf,
  toolSummary,
} from './activity'

// Consecutive steps hang off one timeline; a lone step is a plain disclosure.

const TONE_DOT: Record<NodeTone, string> = {
  // Amber for anything with a side effect, so a run that changed the working
  // tree is visible without reading a word of it.
  write: 'bg-amber-500',
  read: 'bg-muted-foreground/40',
  error: 'bg-destructive',
  running: 'animate-pulse bg-sky-500',
  // Hollow: reasoning did not touch anything.
  thinking: 'border border-muted-foreground/40',
}

type StepProps = {
  item: ProcessBubble
  grouped?: boolean
}

export const Step = ({ item, grouped = false }: StepProps) => {
  const __ = useLocale()
  const [open, setOpen] = useState(false)
  const tone = toneOf(item)

  const label = item.kind === 'thinking' ? __('transcript.thinking') : item.name
  const detail =
    item.kind === 'thinking' ? previewOf(item.text) : toolSummary(item.name, item.input)

  return (
    <div
      className="relative min-w-0 text-muted-foreground text-xs"
      data-testid={`step-${item.kind}`}
      data-tone={tone}
    >
      {grouped && (
        <span
          aria-hidden="true"
          className="absolute top-3 -left-4 flex size-2 items-center justify-center"
        >
          <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
        </span>
      )}
      <button
        type="button"
        className="flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="step-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
        />
        <span className="shrink-0 font-medium text-foreground/70">{label}</span>
        {(item.kind !== 'thinking' || !open) && (
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              item.kind === 'tool' && 'font-mono text-[11px]',
            )}
          >
            {detail}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-0.5 mb-2 ml-5 min-w-0 text-foreground/80">
          {item.kind === 'thinking' ? (
            // Deliberately not rendered as markdown, though it sometimes
            // contains some. Reasoning is the model talking to itself, not a
            // document — giving it headings and a document's type scale makes
            // it compete with the answer, which is what folding was for.
            <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-2 text-[11px]">
              {item.output ?? JSON.stringify(item.input, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export const ActivityBlock = ({ group }: { group: ActivityGroup }) => {
  const __ = useLocale()
  const [choice, setChoice] = useState<boolean | null>(null)
  // A live group opens by default — work is happening and you want to watch it.
  // But a choice outranks that: having folded it once, it must not spring back
  // open on the next frame that arrives.
  const open = choice ?? group.live

  const { steps, parts, failed } = summarise(group, __('transcript.thinking'))

  return (
    <div
      className="text-muted-foreground text-xs"
      data-testid="activity-group"
      data-live={group.live}
    >
      <button
        type="button"
        className="flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="activity-toggle"
        aria-expanded={open}
        onClick={() => setChoice(!open)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
        />
        <span>{__(steps === 1 ? 'transcript.step' : 'transcript.steps', String(steps))}</span>
        {parts.map(part => (
          <span key={part} className="before:mr-1.5 before:content-['·']">
            {part}
          </span>
        ))}
        {/* Folding hides detail. It must never hide that something broke. */}
        {failed > 0 && (
          <span className="text-destructive before:mr-1.5 before:content-['·']">
            {__('transcript.failed', String(failed))}
          </span>
        )}
        {group.live && (
          <span className="animate-pulse before:mr-1.5 before:content-['·']">
            {__('transcript.running')}
          </span>
        )}
      </button>

      {open && (
        <div className="relative mt-1.5 space-y-1 pl-4 before:absolute before:inset-y-4 before:left-[3px] before:border-border before:border-l">
          {group.items.map(item => (
            <Step key={item.key} item={item} grouped />
          ))}
        </div>
      )}
    </div>
  )
}
