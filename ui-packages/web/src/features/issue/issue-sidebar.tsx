import type { Id, IssueDetail, IssueLabel } from '@idea/shared'
import { useMemo, useState } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'
import { useErrorMessage } from '../../i18n/use-error-message'
import { setIssueLabels, setIssueType } from './api'
import { IssueMetadataFields } from './issue-metadata-fields'

export const IssueSidebar = ({
  appId,
  issue,
  labels,
  onChange,
  onManageLabels,
}: {
  appId: Id
  issue: IssueDetail
  labels: readonly IssueLabel[]
  onChange: (issue: IssueDetail) => void
  onManageLabels: () => void
}) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const errorMessage = useErrorMessage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: false,
      }),
    [locale],
  )
  const change = async (operation: Promise<IssueDetail>) => {
    setSaving(true)
    setError(null)
    try {
      onChange(await operation)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className="space-y-5 border-border border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5"
      aria-busy={saving}
    >
      <IssueMetadataFields
        idPrefix="issue-detail"
        type={issue.type}
        labelIds={issue.labels.map(label => label.id)}
        labels={labels}
        disabled={saving}
        onTypeChange={type => void change(setIssueType(appId, issue.number, type))}
        onLabelIdsChange={labelIds =>
          void change(setIssueLabels(appId, issue.number, labelIds))
        }
        onManageLabels={onManageLabels}
      />
      {saving && (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {__('issue.savingDetails')}
        </p>
      )}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <section className="border-border border-t pt-4">
        <p className="text-muted-foreground text-xs">
          {__('issue.createdBy', issue.createdBy.name)}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {__('issue.updatedAt', dateTime.format(new Date(issue.updatedAt)))}
        </p>
      </section>
    </aside>
  )
}
