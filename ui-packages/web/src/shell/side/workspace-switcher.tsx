import type { WorkspaceMembership } from '@idea/shared'
import { Building2, Check, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChooseWorkspace, useCurrentWorkspaceId } from '../../core/session/use-session'
import { listWorkspaces } from '../../features/workspace/api'
import { useLocale } from '../../i18n'
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../../ui'

// Lives in the shell, not in the workspace feature: it reads core session state
// and drives navigation for every other feature, which is exactly the kind of
// cross-cutting composition a leaf feature should not own.
export const WorkspaceSwitcher = () => {
  const __ = useLocale()
  const workspaceId = useCurrentWorkspaceId()
  const chooseWorkspace = useChooseWorkspace()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
  }, [])

  const current = workspaces.find(w => w.id === workspaceId)

  // Every open tab and the attached conversation belong to the workspace being
  // left. Carrying them across would leave the URL pointing at a requirement the
  // user can no longer see — so the address resets with the switch.
  //
  // This is the one place the session store and the URL have to know about each
  // other, and it runs one way only: the store changes, the URL resets.
  const choose = async (id: number) => {
    await chooseWorkspace(id)
    navigate('/apps', { replace: true })
  }

  // Renders nothing below two workspaces. With only one, "which workspace am I
  // in" is not a question worth answering — there is only one place, and both a
  // switcher and a bare label would just be furniture.
  if (workspaces.length < 2) return null

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="min-w-0" data-testid="workspace-switcher">
        <Building2 />
        <span className="min-w-0 flex-1 truncate">{current?.name ?? __('common.loading')}</span>
        <ChevronRight />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={4} className="min-w-48 max-w-64">
        {workspaces.map(w => (
          <DropdownMenuItem
            key={w.id}
            data-testid={`workspace-${w.id}`}
            onSelect={() => void choose(w.id)}
          >
            {w.id === workspaceId ? <Check /> : <span className="w-4" />}
            <span className="truncate">{w.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
