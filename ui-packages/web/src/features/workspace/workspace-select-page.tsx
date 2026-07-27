import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@idea/design'
import type { WorkspaceMembership } from '@idea/shared'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChooseWorkspace } from '../../core/session/use-session.ts'
import { listWorkspaces } from './api.ts'

// Shown only when a user belongs to more than one workspace — login preselects
// the single one otherwise.
export const WorkspaceSelectPage = () => {
  const chooseWorkspace = useChooseWorkspace()
  const navigate = useNavigate()

  // Local state, not a store: one consumer, and it is re-read whenever this page
  // mounts. Putting it in a store would add an invalidation question with no
  // good answer.
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[] | null>(null)

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [])

  const pick = async (id: number) => {
    await chooseWorkspace(id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>选择工作空间</CardTitle>
          <CardDescription>你属于多个工作空间，选择一个进入</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {workspaces === null && <p className="text-sm text-muted-foreground">加载中…</p>}
          {workspaces?.length === 0 && (
            <p className="text-sm text-muted-foreground">你还不属于任何工作空间。</p>
          )}
          {workspaces?.map(w => (
            <Button
              key={w.id}
              variant="outline"
              className="justify-between"
              onClick={() => pick(w.id)}
            >
              <span>{w.name}</span>
              <span className="text-xs text-muted-foreground">
                {w.role === 'admin' ? '管理员' : '成员'}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
