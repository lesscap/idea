import type {
  RequirementDraft,
  RequirementRevision,
  RequirementRevisionSummary,
  RequirementStatus,
} from '@idea/shared'
import { MessageSquareText } from 'lucide-react'
import { useLocale } from '../../../i18n'
import { Badge, Button } from '../../../ui'
import { RequirementVersionMenu, type RequirementVersionSelection } from './version-menu'

const statusClass: Record<RequirementStatus, string> = {
  draft: 'border-warning/40 bg-warning/10 text-foreground',
  active: 'border-success/30 bg-success/10 text-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}

type RequirementDetailToolbarProps = {
  code: string
  status: RequirementStatus
  draft: RequirementDraft | null
  currentRevision: RequirementRevision | null
  revisions: readonly RequirementRevisionSummary[]
  selected: RequirementVersionSelection | null
  contentStatus: 'loading' | 'ready' | 'failed' | 'unavailable'
  sourceConversationCid: string | null
  onSelect: (selection: RequirementVersionSelection) => void
  onShowConversation: (cid: string) => void
}

export const RequirementDetailToolbar = ({
  code,
  status,
  draft,
  currentRevision,
  revisions,
  selected,
  contentStatus,
  sourceConversationCid,
  onSelect,
  onShowConversation,
}: RequirementDetailToolbarProps) => {
  const __ = useLocale()

  return (
    <header
      className="sticky top-0 z-20 border-border border-b bg-background"
      data-testid="requirement-detail-toolbar"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2 @min-[40rem]:grid-cols-[auto_minmax(0,1fr)_auto] @min-[40rem]:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs">{code}</span>
          <Badge variant="outline" className={statusClass[status]}>
            {__(`requirement.status.${status}`)}
          </Badge>
        </div>

        {selected && (
          <div className="col-span-2 min-w-0 @min-[40rem]:col-span-1 @min-[40rem]:col-start-2 @min-[40rem]:row-start-1">
            <RequirementVersionMenu
              draft={draft}
              currentRevision={currentRevision}
              revisions={revisions}
              selected={selected}
              contentStatus={contentStatus}
              onSelect={onSelect}
            />
          </div>
        )}

        {sourceConversationCid && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-start-2 row-start-1 justify-self-end @min-[40rem]:col-start-3"
            onClick={() => onShowConversation(sourceConversationCid)}
          >
            <MessageSquareText />
            {__('requirement.sourceConversation')}
          </Button>
        )}
      </div>
    </header>
  )
}
