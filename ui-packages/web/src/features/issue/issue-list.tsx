import type { Id, IssueLabel, IssueState, IssueSummary, IssueType, Paged } from '@idea/shared'
import { CircleDot, ListFilter, Plus, Search, Tag, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { Button, Input, Pagination } from '../../ui'
import {
  issueResourceRef,
  labelsResourceRef,
  listIssues,
  listLabels,
  newIssueResourceRef,
} from './api'
import { IssueTypeSelect } from './issue-type-select'
import { LabelChip } from './label-chip'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly page: Paged<IssueSummary> }
  | { readonly status: 'failed' }

const typeDot: Record<IssueType, string> = {
  bug: 'border-red-600',
  feature: 'border-blue-600',
  task: 'border-amber-600',
}

const IssueRow = ({
  issue,
  dateFormatter,
  onOpen,
}: {
  issue: IssueSummary
  dateFormatter: Intl.DateTimeFormat
  onOpen: () => void
}) => {
  const __ = useLocale()
  return (
    <button
      type="button"
      className="grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-2 border-border border-b px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={onOpen}
    >
      <CircleDot
        className={`mt-0.5 size-4 ${issue.state === 'open' ? 'text-success' : 'text-muted-foreground'}`}
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{issue.title}</span>
          {issue.type && (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              <span className={`size-2 rounded-full border-2 ${typeDot[issue.type]}`} />
              {__(`issue.types.${issue.type}`)}
            </span>
          )}
          {issue.labels.map(label => (
            <LabelChip key={label.id} label={label} />
          ))}
        </span>
        <span className="mt-1 block text-muted-foreground text-xs">
          {__(
            'issue.rowMeta',
            issue.number,
            issue.createdBy.name,
            dateFormatter.format(new Date(issue.updatedAt)),
          )}
        </span>
      </span>
      <span className="mt-0.5 text-muted-foreground text-xs">#{issue.number}</span>
    </button>
  )
}

export const IssueList = ({
  appId,
  openResource,
}: {
  appId: Id
  openResource: (ref: string) => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const requestRef = useRef<object | null>(null)
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [issueState, setIssueState] = useState<IssueState>('open')
  const [pageNumber, setPageNumber] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<IssueType | null>(null)
  const [labelIds, setLabelIds] = useState<readonly Id[]>([])
  const [labels, setLabels] = useState<readonly IssueLabel[]>([])
  const [attempt, setAttempt] = useState(0)
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium' }),
    [locale],
  )

  useEffect(() => {
    listLabels(appId).then(setLabels, error => console.error('could not load labels', error))
  }, [appId])

  useEffect(() => {
    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    listIssues(appId, { page: pageNumber, state: issueState, search, type, labelIds }).then(
      page => {
        if (requestRef.current === request) setState({ status: 'ready', page })
      },
      error => {
        console.error('could not load issues', error)
        if (requestRef.current === request) setState({ status: 'failed' })
      },
    )
    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt, issueState, labelIds, pageNumber, search, type])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setPageNumber(1)
    setSearch(searchInput.trim())
  }
  const page = state.status === 'ready' ? state.page : null

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="issue-list-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-5 py-4">
        <div>
          <h1 className="font-semibold text-xl tracking-tight">{__('issue.titlePlural')}</h1>
          <p className="mt-0.5 text-muted-foreground text-sm">{__('issue.listDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openResource(labelsResourceRef)}>
            <Tag />
            {__('issue.labels')}
          </Button>
          <Button onClick={() => openResource(newIssueResourceRef)}>
            <Plus />
            {__('issue.new')}
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-border border-b px-4 py-2.5">
        <div className="flex rounded-md border border-input p-0.5">
          {(['open', 'closed'] as const).map(value => (
            <button
              key={value}
              type="button"
              className={`rounded px-3 py-1.5 text-sm ${issueState === value ? 'bg-nav-active font-medium' : 'text-muted-foreground hover:bg-nav-hover'}`}
              onClick={() => {
                setIssueState(value)
                setPageNumber(1)
              }}
            >
              {__(`issue.states.${value}`)}
            </button>
          ))}
        </div>
        <form className="relative min-w-56 flex-1 sm:max-w-md" onSubmit={submitSearch}>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pr-8 pl-8"
            type="search"
            value={searchInput}
            placeholder={__('issue.searchPlaceholder')}
            onChange={event => setSearchInput(event.target.value)}
          />
          {(searchInput || search) && (
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              aria-label={__('issue.clearSearch')}
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setPageNumber(1)
              }}
            >
              <X className="size-4" />
            </button>
          )}
        </form>
        <IssueTypeSelect
          className="w-32"
          value={type}
          emptyLabel={__('issue.allTypes')}
          ariaLabel={__('issue.filterType')}
          onValueChange={next => {
            setType(next)
            setPageNumber(1)
          }}
        />
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-muted">
            <ListFilter className="size-4" />
            {__('issue.filterLabels')}
            {labelIds.length > 0 ? ` · ${labelIds.length}` : ''}
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-border bg-popover p-2 shadow-md">
            {labels.length === 0 ? (
              <p className="p-2 text-muted-foreground text-sm">{__('issue.noLabels')}</p>
            ) : (
              labels.map(label => (
                <label
                  key={label.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={labelIds.includes(label.id)}
                    onChange={() => {
                      setLabelIds(current =>
                        current.includes(label.id)
                          ? current.filter(id => id !== label.id)
                          : [...current, label.id],
                      )
                      setPageNumber(1)
                    }}
                  />
                  <LabelChip label={label} />
                </label>
              ))
            )}
          </div>
        </details>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {state.status === 'loading' && (
          <div className="space-y-px" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map(row => (
              <div
                key={row}
                className="h-16 animate-pulse border-border border-b bg-muted/30 motion-reduce:animate-none"
              />
            ))}
          </div>
        )}
        {state.status === 'failed' && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm">{__('issue.listLoadFailed')}</p>
            <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>
              {__('common.retry')}
            </Button>
          </div>
        )}
        {page?.items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <CircleDot className="size-8 text-muted-foreground" />
            <p className="font-medium">{__('issue.empty')}</p>
            <p className="text-muted-foreground text-sm">{__('issue.emptyHint')}</p>
          </div>
        )}
        {page?.items.map(issue => (
          <IssueRow
            key={issue.id}
            issue={issue}
            dateFormatter={dateFormatter}
            onOpen={() => openResource(issueResourceRef(issue.number))}
          />
        ))}
      </div>
      {page && page.total > 0 && (
        <Pagination
          page={page.page}
          pageSize={page.pageSize}
          total={page.total}
          ariaLabel={__('issue.pagination')}
          previousLabel={__('issue.previous')}
          nextLabel={__('issue.next')}
          totalLabel={__('issue.total', page.total)}
          pageLabel={number => __('issue.page', number)}
          className="border-border border-t px-4 py-2"
          onPageChange={setPageNumber}
        />
      )}
    </main>
  )
}
