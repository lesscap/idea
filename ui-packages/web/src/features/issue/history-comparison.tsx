import type { Attachment, IssueRevision } from '@idea/shared'
import { AlertCircle, FileMinus2, FilePlus2 } from 'lucide-react'
import { useLocale } from '../../i18n'
import { AppMarkdown } from '../../parts/app-markdown'
import { Button } from '../../ui'
import styles from './style.module.scss'

export type RevisionComparisonState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly revisionNumber: number }
  | {
      readonly status: 'ready'
      readonly current: IssueRevision
      readonly previous: IssueRevision | null
    }
  | { readonly status: 'failed'; readonly revisionNumber: number }

const changedFiles = (current: readonly Attachment[], previous: readonly Attachment[]) => {
  const previousIds = new Set(previous.map(file => file.fid))
  const currentIds = new Set(current.map(file => file.fid))
  return {
    added: current.filter(file => !previousIds.has(file.fid)),
    removed: previous.filter(file => !currentIds.has(file.fid)),
  }
}

const ComparisonLoading = () => (
  <div className="space-y-6 p-5" aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading</span>
    <div className="space-y-2">
      <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-3 w-3/5 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
    </div>
    {[0, 1].map(item => (
      <div key={item} className="space-y-3 border-border border-t pt-5 first:border-t-0 first:pt-0">
        <div className="h-3.5 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded bg-muted/50 motion-reduce:animate-none" />
      </div>
    ))}
  </div>
)

const RevisionContent = ({ revision }: { revision: IssueRevision }) => (
  <>
    <p className="mb-3 font-medium">{revision.title}</p>
    <AppMarkdown text={revision.body} files={revision.images} className={styles.markdown} />
  </>
)

export const HistoryComparison = ({
  state,
  dateTimeFormatter,
  onRetry,
}: {
  state: Exclude<RevisionComparisonState, { status: 'idle' }>
  dateTimeFormatter: Intl.DateTimeFormat
  onRetry: (revisionNumber: number) => void
}) => {
  const __ = useLocale()
  if (state.status === 'loading') return <ComparisonLoading />
  if (state.status === 'failed')
    return (
      <div
        className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center"
        role="alert"
      >
        <AlertCircle className="size-8 text-destructive" />
        <p className="max-w-xs text-sm">{__('issue.revisionLoadFailed')}</p>
        <Button variant="outline" size="sm" onClick={() => onRetry(state.revisionNumber)}>
          {__('common.retry')}
        </Button>
      </div>
    )

  const previousFiles = state.previous
    ? [...state.previous.images, ...state.previous.attachments]
    : []
  const files = changedFiles([...state.current.images, ...state.current.attachments], previousFiles)
  return (
    <div className="p-5">
      <div className="mb-6 text-muted-foreground text-sm">
        <p>{__('issue.activity.edited', state.current.editedBy.name)}</p>
        <time className="mt-1 block text-xs" dateTime={state.current.createdAt}>
          {dateTimeFormatter.format(new Date(state.current.createdAt))}
        </time>
      </div>

      <section aria-labelledby="history-before-heading">
        <h2 id="history-before-heading" className="mb-3 font-medium text-muted-foreground text-sm">
          {__('issue.before')}
        </h2>
        {state.previous ? (
          <RevisionContent revision={state.previous} />
        ) : (
          <p className="text-muted-foreground text-sm">{__('issue.noPreviousRevision')}</p>
        )}
      </section>

      <section className="mt-6 border-border border-t pt-6" aria-labelledby="history-after-heading">
        <h2 id="history-after-heading" className="mb-3 font-medium text-muted-foreground text-sm">
          {__('issue.after')}
        </h2>
        <RevisionContent revision={state.current} />
      </section>

      {(files.added.length > 0 || files.removed.length > 0) && (
        <section
          className="mt-6 border-border border-t pt-6"
          aria-labelledby="history-files-heading"
        >
          <h2 id="history-files-heading" className="font-medium text-muted-foreground text-sm">
            {__('issue.fileChanges')}
          </h2>
          <div className="mt-3 space-y-2">
            {files.added.map(file => (
              <p key={`add-${file.fid}`} className="flex items-center gap-2 text-sm text-success">
                <FilePlus2 className="size-4" />
                {file.filename}
              </p>
            ))}
            {files.removed.map(file => (
              <p
                key={`remove-${file.fid}`}
                className="flex items-center gap-2 text-destructive text-sm"
              >
                <FileMinus2 className="size-4" />
                {file.filename}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
