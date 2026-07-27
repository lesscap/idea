import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@idea/design'
import type { App, AppStatus } from '@idea/shared'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentWorkspaceId } from '../../core/session/use-session.ts'
import { listApps } from './api.ts'
import { CreateAppDialog } from './create-app-dialog.tsx'

const STATUS_LABEL: Record<AppStatus, string> = {
  draft: '草稿',
  active: '使用中',
  archived: '已归档',
}

export const AppListPage = () => {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">应用</h1>
          <p className="text-sm text-muted-foreground">这个空间里正在创建的软件</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          新建应用
        </Button>
      </div>

      {apps === null && <p className="text-sm text-muted-foreground">加载中…</p>}

      {apps?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>还没有应用</CardTitle>
            <CardDescription>新建一个应用，然后把想要它做什么讲清楚。</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {apps?.map(app => (
          <Card key={app.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{app.name}</CardTitle>
                <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                  {STATUS_LABEL[app.status]}
                </Badge>
              </div>
              {app.description && <CardDescription>{app.description}</CardDescription>}
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              创建于 {new Date(app.createdAt).toLocaleDateString('zh-CN')}
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateAppDialog open={creating} onOpenChange={setCreating} onCreated={load} />
    </div>
  )
}
