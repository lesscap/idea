import type { Id, IssueLabel } from '@idea/shared'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { createIssue, issueResourceRef, listLabels } from './api'
import { IssueEditor } from './issue-editor'

export const NewIssue = ({
  appId,
  openResource,
  replaceResource,
}: {
  appId: Id
  openResource: (ref: string) => void
  replaceResource: (ref: string) => void
}) => {
  const __ = useLocale()
  const [labels, setLabels] = useState<readonly IssueLabel[]>([])
  useEffect(() => {
    listLabels(appId).then(setLabels, error => console.error('could not load labels', error))
  }, [appId])
  return (
    <main className="h-full overflow-auto">
      <header className="border-border border-b px-5 py-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => openResource('issues')}>
          <ArrowLeft />
          {__('issue.backToIssues')}
        </Button>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-6">
        <h1 className="font-semibold text-2xl tracking-tight">{__('issue.new')}</h1>
        <p className="mt-1 mb-6 text-muted-foreground text-sm">{__('issue.newDescription')}</p>
        <IssueEditor
          appId={appId}
          labels={labels}
          submitLabel={__('issue.create')}
          onCancel={() => openResource('issues')}
          onSubmit={async value => {
            const created = await createIssue(appId, value)
            replaceResource(issueResourceRef(created.number))
          }}
        />
      </div>
    </main>
  )
}
