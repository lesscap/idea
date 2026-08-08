import type { Id, Paged, RequirementStatus, RequirementSummary } from '@idea/shared'
import { ArrowRight, FileText, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { Badge, Button } from '../../ui'
import { listRequirements, requirementResourceRef } from './api'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly page: Paged<RequirementSummary> }
  | { readonly status: 'failed' }

type MoreState = 'idle' | 'loading' | 'failed'

const statusClass: Record<RequirementStatus, string> = {
  draft: 'border-warning/40 bg-warning/10 text-foreground',
  active: 'border-success/30 bg-success/10 text-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}

const RequirementListSkeleton = () => (
  <div className="divide-y divide-border border-y border-border" aria-busy="true">
    {[1, 2, 3].map(row => (
      <div key={row} className="flex gap-5 py-5 motion-reduce:animate-none">
        <div className="h-5 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-5 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
      </div>
    ))}
  </div>
)

const mergePages = (
  current: Paged<RequirementSummary>,
  next: Paged<RequirementSummary>,
): Paged<RequirementSummary> => ({
  ...next,
  items: [
    ...new Map(
      [...current.items, ...next.items].map(requirement => [requirement.id, requirement]),
    ).values(),
  ],
})

export const RequirementList = ({
  appId,
  openResource,
}: {
  appId: Id
  openResource: (ref: string) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [moreState, setMoreState] = useState<MoreState>('idle')
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef<{ readonly attempt: number } | null>(null)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
        dateStyle: 'medium',
      }),
    [locale],
  )

  useEffect(() => {
    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    setMoreState('idle')
    listRequirements(appId).then(
      page => {
        if (requestRef.current === request) setState({ status: 'ready', page })
      },
      () => {
        if (requestRef.current === request) setState({ status: 'failed' })
      },
    )
    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt])

  const loadMore = () => {
    if (state.status !== 'ready' || moreState === 'loading') return
    setMoreState('loading')
    listRequirements(appId, state.page.page + 1).then(
      page => {
        setState(current =>
          current.status === 'ready'
            ? { status: 'ready', page: mergePages(current.page, page) }
            : current,
        )
        setMoreState('idle')
      },
      () => setMoreState('failed'),
    )
  }

  const page = state.status === 'ready' ? state.page : null
  const hasMore = page !== null && page.page * page.pageSize < page.total

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 sm:p-7 lg:p-9">
      <header className="flex items-end justify-between gap-4 border-border border-b pb-5">
        <div>
          <h1 className="font-semibold text-2xl tracking-[-0.02em]">{__('requirement.heading')}</h1>
          {page && (
            <p className="mt-1 text-muted-foreground text-sm">
              {__('requirement.total', page.total)}
            </p>
          )}
        </div>
      </header>

      {state.status === 'loading' && <RequirementListSkeleton />}

      {state.status === 'failed' && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.listLoadFailed')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt(value => value + 1)}
          >
            <RefreshCw />
            {__('common.retry')}
          </Button>
        </div>
      )}

      {page?.items.length === 0 && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">{__('requirement.empty')}</p>
          <p className="max-w-md text-muted-foreground text-sm">{__('requirement.emptyHint')}</p>
        </div>
      )}

      {page && page.items.length > 0 && (
        <div
          className="divide-y divide-border border-y border-border"
          data-testid="requirement-list"
        >
          {page.items.map(requirement => (
            <button
              key={requirement.id}
              type="button"
              className="group flex w-full items-start gap-4 px-1 py-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-6 sm:px-3"
              onClick={() => openResource(requirementResourceRef(requirement.code))}
            >
              <span className="mt-0.5 shrink-0 font-mono text-muted-foreground text-sm">
                {requirement.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-balance font-medium text-base">
                  {requirement.title || __('requirement.untitled')}
                </span>
                {requirement.summary && (
                  <span className="mt-1 line-clamp-2 block max-w-[70ch] text-muted-foreground text-sm leading-6">
                    {requirement.summary}
                  </span>
                )}
                <span className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className={statusClass[requirement.status]}>
                    {__(`requirement.status.${requirement.status}`)}
                  </Badge>
                  {requirement.currentRevisionCode && (
                    <span className="font-mono text-muted-foreground">
                      {requirement.currentRevisionCode}
                    </span>
                  )}
                  {requirement.hasDraft && (
                    <Badge
                      variant="outline"
                      className="border-warning/40 bg-warning/10 text-foreground"
                    >
                      {__('requirement.hasDraft')}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {__(
                      'requirement.updatedAt',
                      dateFormatter.format(new Date(requirement.updatedAt)),
                    )}
                  </span>
                </span>
              </span>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={moreState === 'loading'}
            onClick={loadMore}
          >
            {moreState === 'loading' ? __('requirement.loadingMore') : __('requirement.loadMore')}
          </Button>
          {moreState === 'failed' && (
            <p className="text-destructive text-sm" role="alert">
              {__('requirement.loadMoreFailed')}
            </p>
          )}
        </div>
      )}
    </main>
  )
}
