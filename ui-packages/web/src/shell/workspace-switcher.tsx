import type { WorkspaceMembership } from '@idea/shared'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useChooseWorkspace, useCurrentWorkspaceId } from '../core/session/use-session.ts'
import { listWorkspaces } from '../features/workspace/api.ts'
import { useLocale } from '../i18n/index.tsx'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/index.ts'

// Lives in the shell, not in the workspace feature: it reads core session state
// and drives navigation for every other feature, which is exactly the kind of
// cross-cutting composition a leaf feature should not own.
export const WorkspaceSwitcher = () => {
  const __ = useLocale()
  const workspaceId = useCurrentWorkspaceId()
  const chooseWorkspace = useChooseWorkspace()
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [])

  const current = workspaces.find(w => w.id === workspaceId)

  // Renders nothing below two workspaces. With only one, "which workspace am I
  // in" is not a question worth answering — there is only one place, and both a
  // switcher and a bare label would just be furniture.
  if (workspaces.length < 2) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          data-testid="workspace-switcher"
        >
          {current?.name ?? __('common.loading')}
          <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {workspaces.map(w => (
          <DropdownMenuItem
            key={w.id}
            data-testid={`workspace-${w.id}`}
            onSelect={() => chooseWorkspace(w.id)}
          >
            {w.id === workspaceId ? <Check /> : <span className="w-4" />}
            {w.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
