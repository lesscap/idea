import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@idea/design'
import type { WorkspaceMembership } from '@idea/shared'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useChooseWorkspace, useCurrentWorkspaceId } from '../core/session/use-session.ts'
import { listWorkspaces } from '../features/workspace/api.ts'

// Lives in the shell, not in the workspace feature: it reads core session state
// and drives navigation for every other feature, which is exactly the kind of
// cross-cutting composition a leaf feature should not own.
export const WorkspaceSwitcher = () => {
  const workspaceId = useCurrentWorkspaceId()
  const chooseWorkspace = useChooseWorkspace()
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [])

  const current = workspaces.find(w => w.id === workspaceId)

  // Nothing to switch between until the list has loaded.
  if (workspaces.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          {current?.name ?? '选择空间'}
          <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {workspaces.map(w => (
          <DropdownMenuItem key={w.id} onSelect={() => chooseWorkspace(w.id)}>
            {w.id === workspaceId ? <Check /> : <span className="w-4" />}
            {w.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
