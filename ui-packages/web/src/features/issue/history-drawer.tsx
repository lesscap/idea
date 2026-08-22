import type { Id } from '@idea/shared'
import { ArrowLeft, History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui'
import { getIssueHistory, getIssueRevision } from './api'
import { HistoryComparison, type RevisionComparisonState } from './history-comparison'
import { HistoryTimeline, type HistoryTimelineState } from './history-timeline'

const revisionNumberOf = (state: RevisionComparisonState): number | null =>
  state.status === 'idle'
    ? null
    : state.status === 'ready'
      ? state.current.number
      : state.revisionNumber

export const HistoryDrawer = ({
  appId,
  issueNumber,
  open,
  onOpenChange,
}: {
  appId: Id
  issueNumber: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const [history, setHistory] = useState<HistoryTimelineState>({ status: 'loading' })
  const [comparison, setComparison] = useState<RevisionComparisonState>({ status: 'idle' })
  const historyRequest = useRef<object | null>(null)
  const comparisonRequest = useRef<object | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const formatters = useMemo(() => {
    const language = locale === 'zh' ? 'zh-CN' : 'en-GB'
    return {
      date: new Intl.DateTimeFormat(language, { dateStyle: 'medium' }),
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      dateTime: new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: false,
      }),
    }
  }, [locale])

  const loadHistory = useCallback(() => {
    const request = {}
    historyRequest.current = request
    setHistory({ status: 'loading' })
    void getIssueHistory(appId, issueNumber).then(
      entries => {
        if (historyRequest.current === request) setHistory({ status: 'ready', entries })
      },
      error => {
        console.error('could not load issue history', error)
        if (historyRequest.current === request) setHistory({ status: 'failed' })
      },
    )
    return request
  }, [appId, issueNumber])

  useEffect(() => {
    if (!open) {
      historyRequest.current = null
      comparisonRequest.current = null
      return
    }
    setComparison({ status: 'idle' })
    const request = loadHistory()
    return () => {
      if (historyRequest.current === request) historyRequest.current = null
      comparisonRequest.current = null
    }
  }, [loadHistory, open])

  const compare = useCallback(
    (revisionNumber: number) => {
      const request = {}
      comparisonRequest.current = request
      setComparison({ status: 'loading', revisionNumber })
      void Promise.all([
        getIssueRevision(appId, issueNumber, revisionNumber),
        revisionNumber > 1
          ? getIssueRevision(appId, issueNumber, revisionNumber - 1)
          : Promise.resolve(null),
      ]).then(
        ([current, previous]) => {
          if (comparisonRequest.current === request)
            setComparison({ status: 'ready', current, previous })
        },
        error => {
          console.error('could not load issue revision comparison', error)
          if (comparisonRequest.current === request)
            setComparison({ status: 'failed', revisionNumber })
        },
      )
    },
    [appId, issueNumber],
  )

  const backToHistory = () => {
    comparisonRequest.current = null
    setComparison({ status: 'idle' })
  }
  const revisionNumber = revisionNumberOf(comparison)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 right-0 left-auto h-dvh w-[min(32rem,100vw)] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-y-0 border-r-0 p-0 sm:rounded-none [&>button]:right-2 [&>button]:top-2 [&>button]:z-20 [&>button]:flex [&>button]:size-10 [&>button]:items-center [&>button]:justify-center"
        closeLabel={__('common.close')}
        onOpenAutoFocus={() => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={event => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault()
            returnFocus.current.focus()
          }
          returnFocus.current = null
        }}
      >
        <DialogHeader className="min-h-14 justify-center border-border border-b bg-background px-4 pr-14">
          {revisionNumber === null ? (
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              {__('issue.history')}
            </DialogTitle>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 shrink-0"
                aria-label={__('issue.backToHistory')}
                onClick={backToHistory}
              >
                <ArrowLeft />
              </Button>
              <DialogTitle className="truncate text-base">
                {__('issue.compareRevision', revisionNumber)}
              </DialogTitle>
            </div>
          )}
          <DialogDescription className="sr-only">
            {__('issue.historyDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          {comparison.status === 'idle' ? (
            <HistoryTimeline
              state={history}
              dateFormatter={formatters.date}
              timeFormatter={formatters.time}
              onRetry={loadHistory}
              onSelectRevision={compare}
            />
          ) : (
            <HistoryComparison
              state={comparison}
              dateTimeFormatter={formatters.dateTime}
              onRetry={compare}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
