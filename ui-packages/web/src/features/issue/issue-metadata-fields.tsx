import type { Id, IssueLabel, IssueType } from '@idea/shared'
import { Check, ChevronDown, Settings2 } from 'lucide-react'
import { useLocale } from '../../i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui'
import { IssueTypeSelect } from './issue-type-select'
import { LabelChip } from './label-chip'

export const IssueMetadataFields = ({
  idPrefix,
  type,
  labelIds,
  labels,
  disabled,
  onTypeChange,
  onLabelIdsChange,
  onManageLabels,
}: {
  idPrefix: string
  type: IssueType | null
  labelIds: readonly Id[]
  labels: readonly IssueLabel[]
  disabled?: boolean
  onTypeChange: (type: IssueType | null) => void
  onLabelIdsChange: (labelIds: readonly Id[]) => void
  onManageLabels?: () => void
}) => {
  const __ = useLocale()
  const selected = labels.filter(label => labelIds.includes(label.id))
  const toggleLabel = (labelId: Id) =>
    onLabelIdsChange(
      labelIds.includes(labelId)
        ? labelIds.filter(candidate => candidate !== labelId)
        : [...labelIds, labelId],
    )

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <label className="block font-medium text-sm" htmlFor={`${idPrefix}-type`}>
          {__('issue.type')}
        </label>
        <IssueTypeSelect
          id={`${idPrefix}-type`}
          value={type}
          disabled={disabled}
          emptyLabel={__('issue.noType')}
          ariaLabel={__('issue.type')}
          onValueChange={onTypeChange}
        />
      </section>
      <section className="space-y-2">
        <span className="block font-medium text-sm">{__('issue.labels')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={__('issue.chooseLabels')}
              className="h-auto min-h-9 w-full justify-between whitespace-normal px-2 py-1.5"
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
                {selected.length === 0 ? (
                  <span className="px-1 text-muted-foreground font-normal">
                    {__('issue.noLabels')}
                  </span>
                ) : (
                  selected.map(label => <LabelChip key={label.id} label={label} />)
                )}
              </span>
              <ChevronDown className="text-muted-foreground" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {labels.length === 0 ? (
              <p className="px-2 py-2 text-muted-foreground text-sm">{__('issue.noLabels')}</p>
            ) : (
              labels.map(label => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={labelIds.includes(label.id)}
                  onCheckedChange={() => toggleLabel(label.id)}
                  onSelect={event => event.preventDefault()}
                >
                  <DropdownMenuItemIndicator className="absolute left-2">
                    <Check aria-hidden="true" />
                  </DropdownMenuItemIndicator>
                  <LabelChip label={label} />
                </DropdownMenuCheckboxItem>
              ))
            )}
            {onManageLabels && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onManageLabels}>
                  <Settings2 aria-hidden="true" />
                  {__('issue.manageLabels')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
    </div>
  )
}
