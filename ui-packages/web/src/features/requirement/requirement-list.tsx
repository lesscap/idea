import type { Id, Paged, RequirementSummary } from '@idea/shared'
import { FileText, RefreshCw, Search, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { Button, Input, Pagination } from '../../ui'
import { listRequirements, requirementResourceRef } from './api'
import { RequirementTable } from './requirement-table'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly page: Paged<RequirementSummary> }
  | { readonly status: 'failed' }

type ListQuery = {
  readonly appId: Id
  readonly page: number
  readonly search: string
}

const RequirementListSkeleton = () => (
  <div className="h-full overflow-hidden" aria-busy="true">
    <div className="min-w-[996px]">
      <div className="h-9 border-border border-b bg-muted" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map(row => (
        <div
          key={row}
          className="grid h-13 grid-cols-[6rem_26.25rem_7rem_11rem_9.5rem_2.5rem] items-center border-border border-b px-3"
        >
          <div className="h-3 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  </div>
)

export const RequirementList = ({
  appId,
  openResource,
}: {
  appId: Id
  openResource: (ref: string) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const tableViewportRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<object | null>(null)
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [query, setQuery] = useState<ListQuery>({ appId, page: 1, search: '' })
  const [searchInput, setSearchInput] = useState('')
  const [attempt, setAttempt] = useState(0)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
        dateStyle: 'medium',
      }),
    [locale],
  )

  useEffect(() => {
    if (query.appId !== appId) {
      setQuery({ appId, page: 1, search: '' })
      setSearchInput('')
      return
    }

    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    listRequirements(appId, { page: query.page, search: query.search }).then(
      page => {
        if (requestRef.current !== request) return
        const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize))
        if (query.page > totalPages) {
          setQuery({ ...query, page: totalPages })
          return
        }
        setState({ status: 'ready', page })
      },
      () => {
        if (requestRef.current === request) setState({ status: 'failed' })
      },
    )
    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt, query])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const search = searchInput.trim()
    if (query.appId === appId && query.page === 1 && query.search === search) {
      setAttempt(value => value + 1)
      return
    }
    setQuery({ appId, page: 1, search })
  }

  const clearSearch = () => {
    setSearchInput('')
    if (query.search !== '') setQuery({ appId, page: 1, search: '' })
  }

  const changePage = (page: number) => {
    if (query.appId !== appId || query.page === page) return
    setQuery({ ...query, page })
    tableViewportRef.current?.scrollTo?.({ top: 0 })
  }

  const page = state.status === 'ready' ? state.page : null
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : null
  const hasSearch = query.search !== ''

  return (
    <main
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-testid="requirement-list-page"
      data-state={state.status}
      data-total={page?.total ?? ''}
      data-page={query.appId === appId ? query.page : 1}
      data-total-pages={totalPages ?? ''}
      data-search={query.appId === appId ? query.search : ''}
    >
      <form
        className="flex min-w-0 shrink-0 items-center gap-2 border-border border-b px-4 py-2"
        aria-label={__('requirement.search')}
        onSubmit={submitSearch}
      >
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="h-8 pr-8 pl-8 shadow-none [&::-webkit-search-cancel-button]:appearance-none"
            value={searchInput}
            maxLength={100}
            aria-label={__('requirement.searchPlaceholder')}
            placeholder={__('requirement.searchPlaceholder')}
            data-testid="requirement-search-input"
            onChange={event => setSearchInput(event.target.value)}
          />
          {(searchInput !== '' || hasSearch) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 p-0"
              aria-label={__('requirement.clearSearch')}
              data-testid="requirement-search-clear"
              onClick={clearSearch}
            >
              <X />
            </Button>
          )}
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={state.status === 'loading'}
          data-testid="requirement-search-submit"
        >
          {__('requirement.search')}
        </Button>
      </form>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {state.status === 'loading' && <RequirementListSkeleton />}

        {state.status === 'failed' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm">{__('requirement.listLoadFailed')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="requirement-retry"
              onClick={() => setAttempt(value => value + 1)}
            >
              <RefreshCw />
              {__('common.retry')}
            </Button>
          </div>
        )}

        {page?.items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">
              {hasSearch ? __('requirement.noSearchResults') : __('requirement.empty')}
            </p>
            {!hasSearch && (
              <p className="max-w-md text-muted-foreground text-sm">
                {__('requirement.emptyHint')}
              </p>
            )}
          </div>
        )}

        {page && page.items.length > 0 && (
          <RequirementTable
            items={page.items}
            dateFormatter={dateFormatter}
            viewportRef={tableViewportRef}
            onOpen={code => openResource(requirementResourceRef(code))}
          />
        )}
      </div>

      {page && page.total > 0 && (
        <Pagination
          page={page.page}
          total={page.total}
          pageSize={page.pageSize}
          ariaLabel={__('requirement.pagination.label')}
          previousLabel={__('requirement.pagination.previous')}
          nextLabel={__('requirement.pagination.next')}
          totalLabel={__('requirement.pagination.total', page.total)}
          pageLabel={number => __('requirement.pagination.page', number)}
          className="shrink-0 border-border border-t px-4 py-2"
          testIdPrefix="requirement-pagination"
          onPageChange={changePage}
        />
      )}
    </main>
  )
}
