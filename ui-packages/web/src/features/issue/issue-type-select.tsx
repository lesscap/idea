import type { IssueType } from '@idea/shared'
import { useLocale } from '../../i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui'

const EMPTY_VALUE = 'none'
const issueTypes = ['bug', 'feature', 'task'] as const satisfies readonly IssueType[]

export const IssueTypeSelect = ({
  value,
  emptyLabel,
  ariaLabel,
  id,
  className,
  disabled,
  onValueChange,
}: {
  value: IssueType | null
  emptyLabel: string
  ariaLabel: string
  id?: string
  className?: string
  disabled?: boolean
  onValueChange: (value: IssueType | null) => void
}) => {
  const __ = useLocale()
  return (
    <Select
      value={value ?? EMPTY_VALUE}
      disabled={disabled}
      onValueChange={next => onValueChange(issueTypes.find(type => type === next) ?? null)}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>
        {issueTypes.map(type => (
          <SelectItem key={type} value={type}>
            {__(`issue.types.${type}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
