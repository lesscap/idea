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

// The agent's working-out, drawn as one openable block.
//
// Everything here hangs off a single vertical rule with a dot per step, rather
// than each step carrying its own border. Boxes inside boxes read as a list of
// separate things; one rule reads as one process, and the dots make the shape
// of that process — which step wrote something, which one broke — legible
// before any of the text is.

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

export const Step = ({ item }: { item: ProcessBubble }) => {
  const __ = useLocale()
  const [open, setOpen] = useState(false)
  const tone = toneOf(item)

  const label = item.kind === 'thinking' ? __('transcript.thinking') : item.name
  const detail =
    item.kind === 'thinking' ? previewOf(item.text) : toolSummary(item.name, item.input)

  return (
    <div
      className="relative pl-4 text-muted-foreground text-xs"
      data-testid={`step-${item.kind}`}
      data-tone={tone}
    >
      {/* The step carries its own indent and dot, so it reads the same whether
          it is hanging off a group's rule or standing on its own. */}
      <span className={cn('absolute top-[0.45rem] left-1 size-1.5 rounded-full', TONE_DOT[tone])} />
      <button
        type="button"
        className="flex w-full items-baseline gap-2 text-left hover:text-foreground"
        data-testid="step-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="shrink-0 font-medium text-foreground/70">{label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{detail}</span>
      </button>
      {open && (
        <div className="mt-1 mb-2 text-foreground/80">
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
        className="flex items-center gap-1.5 hover:text-foreground [&_svg]:size-3"
        data-testid="activity-toggle"
        aria-label={__(open ? 'transcript.collapseActivity' : 'transcript.expandActivity')}
        onClick={() => setChoice(!open)}
      >
        <ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
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
        <div className="mt-1.5 ml-[0.3rem] space-y-1 border-border border-l">
          {group.items.map(item => (
            <Step key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
