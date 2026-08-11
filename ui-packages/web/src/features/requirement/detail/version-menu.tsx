import type {
  Id,
  RequirementDraft,
  RequirementRevision,
  RequirementRevisionSummary,
} from '@idea/shared'
import { Check, ChevronDown, History, PencilLine } from 'lucide-react'
import { useMemo } from 'react'
import { useLocale, useLocaleControl } from '../../../i18n'
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../ui'

export type RequirementVersionSelection =
  | { readonly kind: 'draft' }
  | { readonly kind: 'revision'; readonly id: Id }

type RequirementVersionMenuProps = {
  draft: RequirementDraft | null
  currentRevision: RequirementRevision | null
  revisions: readonly RequirementRevisionSummary[]
  selected: RequirementVersionSelection
  contentStatus: 'loading' | 'ready' | 'failed' | 'unavailable'
  onSelect: (selection: RequirementVersionSelection) => void
}

const selectionValue = (selection: RequirementVersionSelection): string =>
  selection.kind === 'draft' ? 'draft' : `revision:${selection.id}`

export const RequirementVersionMenu = ({
  draft,
  currentRevision,
  revisions,
  selected,
  contentStatus,
  onSelect,
}: RequirementVersionMenuProps) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
        dateStyle: 'medium',
      }),
    [locale],
  )
  const selectedRevision =
    selected.kind === 'revision'
      ? (revisions.find(revision => revision.id === selected.id) ?? null)
      : null
  const draftSelected = selected.kind === 'draft'
  const currentId = currentRevision?.id ?? null
  const canChoose = revisions.length + (draft ? 1 : 0) > 1
  const label = draftSelected
    ? __('requirement.version.draft')
    : (selectedRevision?.code ?? __('requirement.version.unknown'))
  const stateLabel = draftSelected
    ? __('requirement.version.unconfirmed')
    : selectedRevision?.id === currentId
      ? __('requirement.version.current')
      : __('requirement.version.historical')
  const timeLabel = draftSelected
    ? draft
      ? __('requirement.version.updatedAt', dateFormatter.format(new Date(draft.updatedAt)))
      : ''
    : selectedRevision
      ? __(
          'requirement.version.confirmedAt',
          dateFormatter.format(new Date(selectedRevision.confirmedAt)),
        )
      : ''

  const choose = (nextValue: string) => {
    if (nextValue === 'draft') {
      onSelect({ kind: 'draft' })
      return
    }
    const revision = revisions.find(
      item => selectionValue({ kind: 'revision', id: item.id }) === nextValue,
    )
    if (revision) onSelect({ kind: 'revision', id: revision.id })
  }

  const versionLabel = (
    <span className="flex min-w-0 items-center gap-2 text-left">
      {draftSelected ? (
        <PencilLine className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <History className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate font-medium text-sm">{label}</span>
    </span>
  )

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
      data-version-kind={selected.kind}
      data-testid="requirement-version-menu"
    >
      <span className="hidden shrink-0 text-muted-foreground text-xs @min-[28rem]:inline">
        {__('requirement.version.viewing')}
      </span>
      {canChoose ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={__('requirement.version.choose')}
            >
              {versionLabel}
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto">
            <DropdownMenuRadioGroup value={selectionValue(selected)} onValueChange={choose}>
              {draft && (
                <DropdownMenuRadioItem value="draft">
                  <PencilLine />
                  <span className="min-w-0">
                    <span className="block">{__('requirement.version.draft')}</span>
                    <span className="block text-muted-foreground text-xs">
                      {__(
                        'requirement.version.updatedAt',
                        dateFormatter.format(new Date(draft.updatedAt)),
                      )}
                    </span>
                  </span>
                  <DropdownMenuItemIndicator className="absolute right-2">
                    <Check />
                  </DropdownMenuItemIndicator>
                </DropdownMenuRadioItem>
              )}
              {revisions.map(revision => (
                <DropdownMenuRadioItem
                  key={revision.id}
                  value={selectionValue({ kind: 'revision', id: revision.id })}
                >
                  <History />
                  <span className="min-w-0">
                    <span className="block">
                      {revision.code}
                      <span className="ml-2 text-muted-foreground text-xs">
                        {revision.id === currentId
                          ? __('requirement.version.current')
                          : __('requirement.version.historical')}
                      </span>
                    </span>
                    <span className="block text-muted-foreground text-xs">
                      {dateFormatter.format(new Date(revision.confirmedAt))}
                    </span>
                  </span>
                  <DropdownMenuItemIndicator className="absolute right-2">
                    <Check />
                  </DropdownMenuItemIndicator>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex h-8 min-w-0 items-center px-2">{versionLabel}</div>
      )}
      <Badge
        variant="outline"
        className={
          draftSelected
            ? 'border-warning/40 bg-warning/10 text-foreground'
            : 'border-border bg-muted/60 text-foreground'
        }
      >
        {stateLabel}
      </Badge>
      {timeLabel && (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{timeLabel}</span>
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {contentStatus === 'loading'
          ? __('requirement.version.loadingAnnouncement', label)
          : contentStatus === 'ready'
            ? __('requirement.version.viewingAnnouncement', label, stateLabel)
            : ''}
      </span>
    </div>
  )
}
