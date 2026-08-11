import type { RequirementContent } from '@idea/shared'
import { FileQuestion, FileText, Paperclip, RefreshCw } from 'lucide-react'
import { useLocale } from '../../../i18n'
import { formatBytes } from '../../../lib/format-bytes'
import { AppMarkdown } from '../../../parts/app-markdown'
import { Button } from '../../../ui'
import styles from './style.module.scss'

export type RequirementDocumentState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: RequirementContent }
  | { readonly status: 'failed' }
  | { readonly status: 'unavailable' }

export const RequirementDocument = ({
  state,
  onRetry,
  onOpenFile,
}: {
  state: RequirementDocumentState
  onRetry: () => void
  onOpenFile: (file: RequirementContent['attachments'][number]) => void
}) => {
  const __ = useLocale()

  if (state.status === 'loading') {
    return (
      <div className="px-4 py-6 @min-[40rem]:px-6" aria-busy="true" data-testid="revision-loading">
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
      <div className="px-4 py-6 @min-[40rem]:px-6">
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
      <div className="px-4 py-6 @min-[40rem]:px-6">
        <div className="flex min-h-56 max-w-[72ch] flex-col items-center justify-center gap-3 text-center">
          <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm">{__('requirement.contentUnavailable')}</p>
        </div>
      </div>
    )
  }

  return (
    <article className="px-4 py-5 @min-[40rem]:px-6" data-testid="requirement-content">
      <div className="max-w-[72ch]">
        <header className="border-border border-b pb-4">
          <h1 className="text-balance font-semibold text-xl tracking-[-0.02em] leading-tight @min-[40rem]:text-[1.375rem]">
            {state.value.title || __('requirement.untitled')}
          </h1>
          {state.value.summary && (
            <p className="mt-1.5 text-pretty text-sm text-muted-foreground leading-5.5">
              {state.value.summary}
            </p>
          )}
        </header>
        <div className="pt-4 pb-7">
          {state.value.body ? (
            <AppMarkdown
              text={state.value.body}
              files={state.value.images}
              className={styles.markdown}
              onOpenFile={onOpenFile}
            />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="size-4" aria-hidden="true" />
              {__('requirement.emptyBody')}
            </div>
          )}
          {state.value.attachments.length > 0 && (
            <section
              className="mt-6 border-border border-t pt-4"
              aria-labelledby="attachments-title"
            >
              <h2
                id="attachments-title"
                className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
              >
                {__('requirement.attachments')}
              </h2>
              <div className="divide-y divide-border rounded-md border border-border">
                {state.value.attachments.map(file => (
                  <button
                    key={file.fid}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => onOpenFile(file)}
                  >
                    <Paperclip
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.filename}</span>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {formatBytes(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
