import type { Attachment, Id, RequirementDetail as RequirementDetailValue } from '@idea/shared'
import { FileQuestion, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import { useLocale } from '../../../i18n'
import { Button } from '../../../ui'
import { RequirementDocument } from './document'
import { useRequirementDetailState } from './state'
import { RequirementDetailToolbar } from './toolbar'
import type { RequirementVersionSelection } from './version-menu'

const DetailSkeleton = () => (
  <main className="@container h-full min-h-0 w-full overflow-y-auto" aria-busy="true">
    <div className="border-border border-b bg-background px-4 py-2 @min-[40rem]:px-6">
      <div className="grid min-h-8 grid-cols-[6rem_minmax(0,20rem)] items-center gap-4">
        <div className="h-4 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-8 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
    <div className="px-4 py-6 @min-[40rem]:px-6">
      <div className="max-w-[72ch] space-y-4">
        <div className="h-9 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
  </main>
)

const DetailFailure = ({ retry }: { retry: () => void }) => {
  const __ = useLocale()

  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center"
      role="alert"
    >
      <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm">{__('requirement.detailLoadFailed')}</p>
      <Button type="button" variant="outline" size="sm" onClick={retry}>
        <RefreshCw />
        {__('common.retry')}
      </Button>
    </div>
  )
}

const ReadyDetail = ({
  requirement,
  selected,
  content,
  selectVersion,
  retryRevision,
  showConversation,
  openFile,
}: {
  requirement: RequirementDetailValue
  selected: RequirementVersionSelection | null
  content: ReturnType<typeof useRequirementDetailState>['content']
  selectVersion: (selection: RequirementVersionSelection) => void
  retryRevision: () => void
  showConversation: (cid: string) => void
  openFile: (file: Attachment) => void
}) => {
  const scrollRef = useRef<HTMLElement>(null)
  const chooseVersion = (selection: RequirementVersionSelection) => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    selectVersion(selection)
  }

  return (
    <main ref={scrollRef} className="@container h-full min-h-0 w-full overflow-y-auto">
      <RequirementDetailToolbar
        code={requirement.code}
        status={requirement.status}
        draft={requirement.draft}
        currentRevision={requirement.currentRevision}
        revisions={requirement.revisions}
        selected={selected}
        contentStatus={content.status}
        sourceConversationCid={content.status === 'ready' ? content.sourceCid : null}
        onSelect={chooseVersion}
        onShowConversation={showConversation}
      />
      <RequirementDocument state={content} onRetry={retryRevision} onOpenFile={openFile} />
    </main>
  )
}

export const RequirementDetail = ({
  params,
  appId,
  showConversation,
  openFile,
}: {
  params: { readonly code?: string }
  appId: Id
  showConversation: (cid: string) => void
  openFile: (file: Attachment) => void
}) => {
  const detail = useRequirementDetailState(appId, params.code ?? '')

  if (detail.state.status === 'loading') return <DetailSkeleton />
  if (detail.state.status === 'failed') return <DetailFailure retry={detail.retryDetail} />

  return (
    <ReadyDetail
      requirement={detail.state.value}
      selected={detail.selection}
      content={detail.content}
      selectVersion={detail.selectVersion}
      retryRevision={detail.retryRevision}
      showConversation={showConversation}
      openFile={openFile}
    />
  )
}
