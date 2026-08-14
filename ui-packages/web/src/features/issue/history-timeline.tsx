import type { IssueActivity, IssueHistoryEntry } from '@idea/shared'
import { AlertCircle, ChevronRight, CircleDot, FileClock, History, Shapes, Tag } from 'lucide-react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { LabelChip } from './label-chip'

export type HistoryTimelineState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly entries: readonly IssueHistoryEntry[] }
  | { readonly status: 'failed' }

type HistoryGroup = {
  readonly key: string
  readonly label: string
  readonly entries: readonly IssueHistoryEntry[]
}

const activityText = (activity: IssueActivity, __: ReturnType<typeof useLocale>): string => {
  if (activity.kind === 'state_changed')
    return activity.toState === 'closed'
      ? __(
          'issue.activity.closed',
          activity.actor.name,
          __(`issue.closeReasons.${activity.closeReason ?? 'completed'}`),
        )
      : __('issue.activity.reopened', activity.actor.name)
  if (activity.kind === 'type_changed')
    return __(
      'issue.activity.typeChanged',
      activity.actor.name,
      activity.toType ? __(`issue.types.${activity.toType}`) : __('issue.noType'),
    )
  return activity.kind === 'label_added'
    ? __('issue.activity.labelAdded', activity.actor.name)
    : __('issue.activity.labelRemoved', activity.actor.name)
}

const groupEntries = (
  entries: readonly IssueHistoryEntry[],
  formatter: Intl.DateTimeFormat,
): readonly HistoryGroup[] =>
  entries.reduce<HistoryGroup[]>((groups, entry) => {
    const label = formatter.format(new Date(entry.createdAt))
    const latest = groups.at(-1)
    if (latest?.key === label) {
      groups[groups.length - 1] = { ...latest, entries: [...latest.entries, entry] }
      return groups
    }
    groups.push({ key: label, label, entries: [entry] })
    return groups
  }, [])

const EventIcon = ({ entry }: { entry: IssueHistoryEntry }) => {
  if (entry.kind === 'revision') return <FileClock />
  if (entry.kind === 'state_changed') return <CircleDot />
  if (entry.kind === 'type_changed') return <Shapes />
  return <Tag />
}

const TimelineEntry = ({
  entry,
  timeFormatter,
  onSelectRevision,
}: {
  entry: IssueHistoryEntry
  timeFormatter: Intl.DateTimeFormat
  onSelectRevision: (revisionNumber: number) => void
}) => {
  const __ = useLocale()
  const content = (
    <>
      <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground [&_svg]:size-3.5">
        <EventIcon entry={entry} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {entry.kind === 'revision'
            ? __('issue.activity.edited', entry.editedBy.name)
            : activityText(entry, __)}
          {entry.kind !== 'revision' &&
            (entry.kind === 'label_added' || entry.kind === 'label_removed') && (
              <LabelChip
                label={{
                  id: entry.labelId ?? -entry.id,
                  name: entry.labelName,
                  description: null,
                  color: entry.labelColor,
                }}
              />
            )}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
          {entry.kind === 'revision' && <span>{__('issue.revisionNumber', entry.number)}</span>}
          {entry.kind === 'revision' && <span aria-hidden="true">·</span>}
          <time dateTime={entry.createdAt}>{timeFormatter.format(new Date(entry.createdAt))}</time>
        </span>
      </span>
    </>
  )

  return (
    <li className="relative before:absolute before:top-7 before:bottom-[-1rem] before:left-3.5 before:w-px before:bg-border last:before:hidden">
      {entry.kind === 'revision' ? (
        <button
          type="button"
          className="group -m-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-label={__('issue.viewRevision', entry.number)}
          onClick={() => onSelectRevision(entry.number)}
        >
          {content}
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </button>
      ) : (
        <div className="flex items-start gap-3">{content}</div>
      )}
    </li>
  )
}

const LoadingTimeline = () => (
  <div className="space-y-6 p-5" aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading</span>
    {[0, 1, 2, 3].map(item => (
      <div key={item} className="flex gap-3">
        <div className="size-7 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
      </div>
    ))}
  </div>
)

export const HistoryTimeline = ({
  state,
  dateFormatter,
  timeFormatter,
  onRetry,
  onSelectRevision,
}: {
  state: HistoryTimelineState
  dateFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  onRetry: () => unknown
  onSelectRevision: (revisionNumber: number) => void
}) => {
  const __ = useLocale()
  if (state.status === 'loading') return <LoadingTimeline />
  if (state.status === 'failed')
    return (
      <div
        className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center"
        role="alert"
      >
        <AlertCircle className="size-8 text-destructive" />
        <p className="max-w-xs text-sm">{__('issue.historyLoadFailed')}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {__('common.retry')}
        </Button>
      </div>
    )
  if (state.entries.length === 0)
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
        <History className="size-8 text-muted-foreground" />
        <p className="font-medium text-sm">{__('issue.historyEmpty')}</p>
        <p className="max-w-xs text-muted-foreground text-sm">{__('issue.historyEmptyHint')}</p>
      </div>
    )

  return (
    <div className="space-y-6 p-5">
      {groupEntries(state.entries, dateFormatter).map(group => (
        <section key={group.key} aria-labelledby={`history-date-${group.key}`}>
          <h2
            id={`history-date-${group.key}`}
            className="mb-4 font-medium text-muted-foreground text-xs"
          >
            {group.label}
          </h2>
          <ol className="space-y-4">
            {group.entries.map(entry => (
              <TimelineEntry
                key={`${entry.kind}-${entry.id}`}
                entry={entry}
                timeFormatter={timeFormatter}
                onSelectRevision={onSelectRevision}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
