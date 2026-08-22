import type { Attachment, Id, IssueDetail as IssueDetailValue, IssueLabel } from '@idea/shared'
import { Check, CircleDot, Clock3, Pencil, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { RequestError } from '../../lib/request'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui'
import {
  closeIssue,
  getIssue,
  labelsResourceRef,
  listLabels,
  reopenIssue,
  updateIssue,
} from './api'
import { HistoryDrawer } from './history-drawer'
import { IssueDocument } from './issue-document'
import { IssueEditor } from './issue-editor'
import { IssueSidebar } from './issue-sidebar'

type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly issue: IssueDetailValue }
  | { readonly status: 'failed' }

export const IssueDetail = ({
  params,
  appId,
  openResource,
  openFile,
}: {
  params: { readonly number?: string }
  appId: Id
  openResource: (ref: string) => void
  openFile: (file: Attachment) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const issueNumber = Number(params.number)
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [labels, setLabels] = useState<readonly IssueLabel[]>([])
  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [statePending, setStatePending] = useState(false)
  const [stateError, setStateError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef<object | null>(null)
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium' }),
    [locale],
  )

  useEffect(() => {
    if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
      setState({ status: 'failed' })
      return
    }
    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    setEditing(false)
    Promise.all([getIssue(appId, issueNumber), listLabels(appId)]).then(
      ([issue, nextLabels]) => {
        if (requestRef.current === request) {
          setState({ status: 'ready', issue })
          setLabels(nextLabels)
        }
      },
      error => {
        console.error('could not load issue', error)
        if (requestRef.current === request) setState({ status: 'failed' })
      },
    )
    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt, issueNumber])

  if (state.status === 'loading')
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-72 animate-pulse rounded bg-muted/50" />
      </div>
    )
  if (state.status === 'failed')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm">{__('issue.detailLoadFailed')}</p>
        <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>
          <RefreshCw />
          {__('common.retry')}
        </Button>
      </div>
    )

  const issue = state.issue
  const apply = (next: IssueDetailValue) => setState({ status: 'ready', issue: next })
  const changeState = async (reason?: 'completed' | 'not_planned') => {
    setStatePending(true)
    setStateError(false)
    try {
      apply(
        issue.state === 'closed'
          ? await reopenIssue(appId, issue.number)
          : await closeIssue(appId, issue.number, reason ?? 'completed'),
      )
    } catch (error) {
      console.error('could not change issue state', error)
      setStateError(true)
    } finally {
      setStatePending(false)
    }
  }

  return (
    <main className="h-full overflow-auto">
      <header className="border-border border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-balance font-semibold text-2xl tracking-tight">
              {editing ? (
                __('issue.editTitle', issue.number)
              ) : (
                <>
                  {issue.title}{' '}
                  <span className="font-normal text-muted-foreground">#{issue.number}</span>
                </>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs ${issue.state === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
              >
                <CircleDot className="size-3.5" />
                {__(`issue.states.${issue.state}`)}
              </span>
              <span className="text-muted-foreground text-sm">
                {__('issue.openedBy', issue.createdBy.name, date.format(new Date(issue.createdAt)))}
              </span>
            </div>
          </div>
          {!editing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-8"
                onClick={() => setHistoryOpen(true)}
              >
                <Clock3 />
                {__('issue.history')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-8"
                onClick={() => setEditing(true)}
              >
                <Pencil />
                {__('issue.edit')}
              </Button>
              {issue.state === 'open' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="h-10 sm:h-8"
                      disabled={statePending}
                    >
                      <Check />
                      {statePending ? __('common.loading') : __('issue.close')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => void changeState('completed')}>
                      {__('issue.closeReasons.completed')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void changeState('not_planned')}>
                      {__('issue.closeReasons.not_planned')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  className="h-10 sm:h-8"
                  disabled={statePending}
                  onClick={() => void changeState()}
                >
                  {statePending ? __('common.loading') : __('issue.reopen')}
                </Button>
              )}
            </div>
          )}
        </div>
        {stateError && (
          <p className="mt-3 text-destructive text-sm" role="alert">
            {__('issue.stateChangeFailed')}
          </p>
        )}
      </header>

      {editing ? (
        <div className="px-5 py-6">
          <IssueEditor
            appId={appId}
            labels={labels}
            initial={issue}
            submitLabel={__('issue.save')}
            onCancel={() => setEditing(false)}
            onSubmit={async value => {
              try {
                apply(
                  await updateIssue(appId, issue.number, {
                    ...value,
                    expectedUpdatedAt: issue.updatedAt,
                  }),
                )
                setEditing(false)
              } catch (error) {
                if (error instanceof RequestError && error.code === 'issue_update_conflict') {
                  try {
                    apply(await getIssue(appId, issue.number))
                  } catch (reloadError) {
                    console.error('could not refresh conflicted issue', reloadError)
                  }
                }
                throw error
              }
            }}
          />
        </div>
      ) : (
        <div className="grid gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <IssueDocument content={issue} onOpenFile={openFile} />
          </div>
          <IssueSidebar
            appId={appId}
            issue={issue}
            labels={labels}
            onChange={apply}
            onManageLabels={() => openResource(labelsResourceRef)}
          />
        </div>
      )}
      <HistoryDrawer
        appId={appId}
        issueNumber={issue.number}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </main>
  )
}
