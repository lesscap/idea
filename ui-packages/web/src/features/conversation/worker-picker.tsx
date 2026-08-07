import { ChevronDown, Monitor, RefreshCw, WifiOff } from 'lucide-react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import type { WorkerAssignment, WorkerOption, WorkersStatus } from './use-conversation'

type WorkerListProps = {
  workers: readonly WorkerOption[]
  status: WorkersStatus
  onRefresh: () => void
}

export const NewConversationWorker = ({
  workers,
  status,
  selectedId,
  onSelect,
  onRefresh,
}: WorkerListProps & {
  selectedId: number | null
  onSelect: (workerId: number) => void
}) => {
  const __ = useLocale()

  return (
    <section
      className="flex max-w-sm flex-col items-center gap-3 text-center"
      aria-labelledby="new-conversation-worker-title"
      data-testid="new-conversation-worker"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Monitor className="size-5" aria-hidden="true" />
      </span>
      <h2 id="new-conversation-worker-title" className="font-medium text-sm">
        {__('shell.worker.choose')}
      </h2>

      {status === 'loading' && (
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      )}
      {status === 'ready' && workers.length > 0 && (
        <div className="relative w-64">
          <select
            className="h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pr-9 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={__('shell.worker.choose')}
            data-testid="worker-select"
            value={selectedId ?? ''}
            onChange={event => onSelect(Number(event.target.value))}
          >
            {workers.map(worker => (
              <option key={worker.id} value={worker.id}>
                {worker.name} · {worker.providerLabel}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      )}
      {status !== 'loading' && (status === 'error' || workers.length === 0) && (
        <div className="text-muted-foreground text-xs">
          <p>{status === 'error' ? __('shell.worker.loadFailed') : __('shell.worker.none')}</p>
          <Button variant="ghost" size="sm" className="mt-1" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            {__('common.retry')}
          </Button>
        </div>
      )}
    </section>
  )
}

export const RecoveryWorker = ({
  assignment,
  workers,
  status,
  busy,
  failed,
  onAssign,
  onRefresh,
}: WorkerListProps & {
  assignment: WorkerAssignment
  busy: boolean
  failed: boolean
  onAssign: (workerId: number) => void
}) => {
  const __ = useLocale()
  const alternatives = workers.filter(
    worker => worker.providerId === assignment.providerId && worker.id !== assignment.worker?.id,
  )

  return (
    <section
      className="flex min-w-0 items-center gap-2 border-border border-t px-3 py-2 text-xs"
      aria-label={__('shell.worker.assignment')}
      data-testid="worker-recovery"
    >
      <WifiOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-muted-foreground">
        {assignment.worker
          ? __('shell.worker.offline', assignment.worker.name)
          : __('shell.worker.unassigned')}
      </span>
      {status === 'ready' && alternatives.length > 0 ? (
        <div className="relative inline-flex max-w-56">
          <select
            className="h-8 max-w-56 appearance-none rounded-md border border-input bg-background py-1 pr-8 pl-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={__('shell.worker.replace')}
            data-testid="worker-replacement"
            value=""
            disabled={busy}
            onChange={event => {
              const id = Number(event.target.value)
              if (id > 0) onAssign(id)
            }}
          >
            <option value="">{__('shell.worker.replace')}</option>
            {alternatives.map(worker => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={status === 'loading'}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" />
          {__('common.retry')}
        </Button>
      )}
      {failed && (
        <span className="text-destructive" role="alert">
          {__('shell.worker.assignFailed')}
        </span>
      )}
    </section>
  )
}
