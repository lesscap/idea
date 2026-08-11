import type { RequirementContent } from '@idea/shared'
import { FileQuestion, FileText, RefreshCw } from 'lucide-react'
import { useLocale } from '../../../i18n'
import { Button, Markdown } from '../../../ui'

export type RequirementDocumentState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: RequirementContent }
  | { readonly status: 'failed' }
  | { readonly status: 'unavailable' }

export const RequirementDocument = ({
  state,
  onRetry,
}: {
  state: RequirementDocumentState
  onRetry: () => void
}) => {
  const __ = useLocale()

  if (state.status === 'loading') {
    return (
      <div
        className="px-4 py-8 @min-[40rem]:px-8 @min-[64rem]:px-10"
        aria-busy="true"
        data-testid="revision-loading"
      >
        <div className="max-w-[72ch] space-y-4">
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        </div>
      </div>
    )
  }

  if (state.status === 'failed') {
    return (
      <div className="px-4 py-8 @min-[40rem]:px-8 @min-[64rem]:px-10">
        <div
          className="flex min-h-56 max-w-[72ch] flex-col items-center justify-center gap-3 text-center"
          role="alert"
        >
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.revisionLoadFailed')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw />
            {__('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="px-4 py-8 @min-[40rem]:px-8 @min-[64rem]:px-10">
        <div className="flex min-h-56 max-w-[72ch] flex-col items-center justify-center gap-3 text-center">
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.contentUnavailable')}</p>
        </div>
      </div>
    )
  }

  return (
    <article
      className="px-4 py-8 @min-[40rem]:px-8 @min-[64rem]:px-10"
      data-testid="requirement-content"
    >
      <div className="max-w-[72ch]">
        <header className="border-border border-b pb-6">
          <h1 className="text-balance font-semibold text-2xl tracking-[-0.025em] leading-tight @min-[40rem]:text-3xl">
            {state.value.title || __('requirement.untitled')}
          </h1>
          {state.value.summary && (
            <p className="mt-3 text-pretty text-base text-muted-foreground leading-7">
              {state.value.summary}
            </p>
          )}
        </header>
        <div className="py-6 @min-[40rem]:py-8">
          {state.value.body ? (
            <Markdown text={state.value.body} variant="document" />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="size-4" aria-hidden="true" />
              {__('requirement.emptyBody')}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
