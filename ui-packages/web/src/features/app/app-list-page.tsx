import type { App } from '@idea/shared'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentWorkspaceId } from '../../core/session/use-session'
import { useLocale, useLocaleControl } from '../../i18n'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui'
import { listApps } from './api'
import { CreateAppDialog } from './create-app-dialog'

export const AppListPage = () => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const workspaceId = useCurrentWorkspaceId()
  // Local state, not a store: one consumer, and refetching on mount answers the
  // "when is this stale?" question that a store would leave open.
  const [apps, setApps] = useState<App[] | null>(null)
  const [creating, setCreating] = useState(false)

  // Guarding on workspaceId is not just a lint accommodation: the endpoint reads
  // the workspace from the session, and calling it with none selected is a 400.
  const load = useCallback(() => {
    if (workspaceId === null) return
    listApps()
      .then(page => setApps([...page.items]))
      .catch(() => setApps([]))
  }, [workspaceId])

  // Refetches when the workspace changes — the server scopes this list to
  // whichever one the session has selected, so switching invalidates it.
  useEffect(load, [load])

  // Intl is built into the browser, so following the interface language costs
  // no dependency — and a hardcoded 'zh-CN' would print Chinese-style dates
  // inside an English interface.
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium' }).format(
      new Date(iso),
    )

  return (
    // Its own padding: the shell no longer wraps content in a padded <main>,
    // because not every resource wants the same inset — a conversation-shaped
    // view wants none at all.
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{__('app.heading')}</h1>
        <Button data-testid="app-create" onClick={() => setCreating(true)}>
          <Plus />
          {__('app.create')}
        </Button>
      </div>

      {apps === null && (
        <p className="text-sm text-muted-foreground" data-testid="apps-loading">
          {__('common.loading')}
        </p>
      )}

      {apps?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{__('app.empty')}</CardTitle>
          </CardHeader>
        </Card>
      )}

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="app-list"
      >
        {apps?.map(app => (
          <Card key={app.id} data-testid="app-card" data-app-id={app.id} data-status={app.status}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{app.name}</CardTitle>
                <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                  {__(`app.status.${app.status}`)}
                </Badge>
              </div>
              {app.description && <CardDescription>{app.description}</CardDescription>}
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {__('app.createdAt', formatDate(app.createdAt))}
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateAppDialog open={creating} onOpenChange={setCreating} onCreated={load} />
    </div>
  )
}
