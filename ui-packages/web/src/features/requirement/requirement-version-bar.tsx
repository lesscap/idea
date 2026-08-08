import type {
  Id,
  RequirementDraft,
  RequirementRevision,
  RequirementRevisionSummary,
} from '@idea/shared'
import { Check, ChevronDown, History, MessageSquareText, PencilLine } from 'lucide-react'
import { useMemo } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui'

export type RequirementVersionSelection =
  | { readonly kind: 'draft' }
  | { readonly kind: 'revision'; readonly id: Id }

type VersionBarProps = {
  draft: RequirementDraft | null
  currentRevision: RequirementRevision | null
  revisions: readonly RequirementRevisionSummary[]
  selected: RequirementVersionSelection
  sourceConversationCid: string | null
  onSelect: (selection: RequirementVersionSelection) => void
  onShowConversation: (cid: string) => void
}

const selectionValue = (selection: RequirementVersionSelection): string =>
  selection.kind === 'draft' ? 'draft' : `revision:${selection.id}`

export const RequirementVersionBar = ({
  draft,
  currentRevision,
  revisions,
  selected,
  sourceConversationCid,
  onSelect,
  onShowConversation,
}: VersionBarProps) => {
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
  const canChoose = revisions.length > 0
  const currentId = currentRevision?.id ?? null
  const value = selectionValue(selected)
  const label = draftSelected
    ? __('requirement.version.draft')
    : (selectedRevision?.code ?? __('requirement.version.unknown'))
  const detail = draftSelected
    ? __('requirement.version.unconfirmed')
    : selectedRevision?.id === currentId
      ? __('requirement.version.current')
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
    <span className="flex min-w-0 items-center gap-3 text-left">
      {draftSelected ? (
        <PencilLine className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <History className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium text-sm">{label}</span>
        <span className="block truncate text-xs opacity-70">{detail}</span>
      </span>
    </span>
  )

  return (
    <div
      className={
        draftSelected
          ? 'sticky top-0 z-20 border border-warning/40 bg-background p-2'
          : 'sticky top-0 z-20 border border-border bg-background p-2'
      }
      data-version-kind={selected.kind}
    >
      <div
        className={
          draftSelected
            ? 'flex min-w-0 flex-col gap-2 rounded-sm bg-warning/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between'
            : 'flex min-w-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        {canChoose ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={__('requirement.version.choose')}
              >
                {versionLabel}
                <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto">
              <DropdownMenuRadioGroup value={value} onValueChange={choose}>
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
                        {revision.id === currentId && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            {__('requirement.version.current')}
                          </span>
                        )}
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
          versionLabel
        )}

        {sourceConversationCid && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => onShowConversation(sourceConversationCid)}
          >
            <MessageSquareText />
            {__('requirement.sourceConversation')}
          </Button>
        )}
      </div>
    </div>
  )
}
