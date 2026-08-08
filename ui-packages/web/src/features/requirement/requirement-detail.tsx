import type {
  Id,
  RequirementContent,
  RequirementDetail as RequirementDetailValue,
  RequirementRevision,
  RequirementStatus,
} from '@idea/shared'
import { FileQuestion, FileText, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Badge, Button, Markdown } from '../../ui'
import { getRequirement, getRequirementByCode, getRequirementRevision } from './api'
import { RequirementVersionBar, type RequirementVersionSelection } from './requirement-version-bar'

type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: RequirementDetailValue }
  | { readonly status: 'failed' }

type RevisionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: RequirementRevision }
  | { readonly status: 'failed' }

type SelectedContent =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly value: RequirementContent
      readonly sourceCid: string | null
    }
  | { readonly status: 'failed'; readonly revisionId: Id }
  | { readonly status: 'unavailable' }

const statusClass: Record<RequirementStatus, string> = {
  draft: 'border-warning/40 bg-warning/10 text-foreground',
  active: 'border-success/30 bg-success/10 text-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}

const initialSelection = (
  requirement: RequirementDetailValue,
): RequirementVersionSelection | null =>
  requirement.draft
    ? { kind: 'draft' }
    : requirement.currentRevision
      ? { kind: 'revision', id: requirement.currentRevision.id }
      : null

const selectedContent = (
  requirement: RequirementDetailValue,
  selection: RequirementVersionSelection | null,
  revisions: ReadonlyMap<Id, RevisionState>,
): SelectedContent => {
  if (!selection) return { status: 'unavailable' }
  if (selection.kind === 'draft') {
    return requirement.draft
      ? {
          status: 'ready',
          value: requirement.draft,
          sourceCid: requirement.draft.updatedInConversationCid,
        }
      : { status: 'unavailable' }
  }
  if (selection.id === requirement.currentRevision?.id) {
    return {
      status: 'ready',
      value: requirement.currentRevision,
      sourceCid: requirement.currentRevision.confirmedInConversationCid,
    }
  }
  const revision = revisions.get(selection.id)
  if (!revision || revision.status === 'loading') return { status: 'loading' }
  if (revision.status === 'failed') return { status: 'failed', revisionId: selection.id }
  return {
    status: 'ready',
    value: revision.value,
    sourceCid: revision.value.confirmedInConversationCid,
  }
}

const DetailSkeleton = () => (
  <div className="mx-auto w-full max-w-4xl space-y-6 p-5 sm:p-8" aria-busy="true">
    <div className="h-4 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    <div className="h-16 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
    <div className="space-y-3 pt-4">
      <div className="h-8 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
    </div>
  </div>
)

export const RequirementDetail = ({
  params,
  appId,
  showConversation,
}: {
  params: { readonly code?: string }
  appId: Id
  showConversation: (cid: string) => void
}) => {
  const __ = useLocale()
  const code = params.code ?? ''
  const rootRef = useRef<HTMLElement>(null)
  const requestRef = useRef<{ readonly attempt: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [selection, setSelection] = useState<RequirementVersionSelection | null>(null)
  const [revisions, setRevisions] = useState<ReadonlyMap<Id, RevisionState>>(new Map())

  useEffect(() => {
    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    setSelection(null)
    setRevisions(new Map())

    getRequirementByCode(appId, code)
      .then(identity => getRequirement(appId, identity.id))
      .then(
        requirement => {
          if (requestRef.current !== request) return
          setState({ status: 'ready', value: requirement })
          setSelection(initialSelection(requirement))
        },
        () => {
          if (requestRef.current === request) setState({ status: 'failed' })
        },
      )

    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt, code])

  const requirement = state.status === 'ready' ? state.value : null
  const content = useMemo(
    () =>
      requirement
        ? selectedContent(requirement, selection, revisions)
        : ({ status: 'unavailable' } as const),
    [requirement, revisions, selection],
  )

  const loadRevision = (requirementId: Id, revisionId: Id) => {
    const request = requestRef.current
    setRevisions(current => new Map(current).set(revisionId, { status: 'loading' }))
    getRequirementRevision(appId, requirementId, revisionId).then(
      revision => {
        if (requestRef.current !== request) return
        setRevisions(current =>
          new Map(current).set(revisionId, { status: 'ready', value: revision }),
        )
      },
      () => {
        if (requestRef.current !== request) return
        setRevisions(current => new Map(current).set(revisionId, { status: 'failed' }))
      },
    )
  }

  const selectVersion = (next: RequirementVersionSelection) => {
    if (!requirement) return
    setSelection(next)
    rootRef.current?.scrollIntoView?.({ block: 'start' })
    if (
      next.kind === 'revision' &&
      next.id !== requirement.currentRevision?.id &&
      !revisions.has(next.id)
    ) {
      loadRevision(requirement.id, next.id)
    }
  }

  if (state.status === 'loading') return <DetailSkeleton />

  if (state.status === 'failed') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm">{__('requirement.detailLoadFailed')}</p>
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
    )
  }

  if (!requirement || !selection) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm">{__('requirement.contentUnavailable')}</p>
      </div>
    )
  }

  const sourceCid = content.status === 'ready' ? content.sourceCid : null

  return (
    <main ref={rootRef} className="mx-auto w-full max-w-4xl p-5 sm:p-8 lg:py-10">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-muted-foreground text-sm">{requirement.code}</span>
        <Badge variant="outline" className={statusClass[requirement.status]}>
          {__(`requirement.status.${requirement.status}`)}
        </Badge>
      </div>

      <RequirementVersionBar
        draft={requirement.draft}
        currentRevision={requirement.currentRevision}
        revisions={requirement.revisions}
        selected={selection}
        sourceConversationCid={sourceCid}
        onSelect={selectVersion}
        onShowConversation={showConversation}
      />

      {content.status === 'loading' && (
        <div className="space-y-4 py-10" aria-busy="true" data-testid="revision-loading">
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
      )}

      {content.status === 'failed' && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.revisionLoadFailed')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadRevision(requirement.id, content.revisionId)}
          >
            <RefreshCw />
            {__('common.retry')}
          </Button>
        </div>
      )}

      {content.status === 'unavailable' && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.contentUnavailable')}</p>
        </div>
      )}

      {content.status === 'ready' && (
        <article className="pt-8" data-testid="requirement-content">
          <header className="max-w-[72ch] border-border border-b pb-7">
            <h1 className="text-balance font-semibold text-3xl tracking-[-0.025em] leading-tight">
              {content.value.title || __('requirement.untitled')}
            </h1>
            {content.value.summary && (
              <p className="mt-4 text-pretty text-base text-muted-foreground leading-7">
                {content.value.summary}
              </p>
            )}
          </header>
          <div className="max-w-[72ch] py-8">
            {content.value.body ? (
              <Markdown text={content.value.body} />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileText className="size-4" aria-hidden="true" />
                {__('requirement.emptyBody')}
              </div>
            )}
          </div>
        </article>
      )}
    </main>
  )
}
