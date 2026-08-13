import type { WorkspaceMembership } from '@idea/shared'
import { Check, ChevronRight, Settings } from 'lucide-react'
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

export const WorkspaceSwitcher = () => {
  const __ = useLocale()
  const workspaceId = useCurrentWorkspaceId()
  const chooseWorkspace = useChooseWorkspace()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([])

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(error => {
        console.error('workspace list failed', error)
        setWorkspaces([])
      })
  }, [])

  const choose = async (id: number) => {
    if (id === workspaceId) return

    try {
      await chooseWorkspace(id)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('workspace switch failed', error)
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="min-w-0" data-testid="workspace-switcher">
        <Settings />
        <span className="min-w-0 flex-1 truncate">{__('workspace.management')}</span>
        <ChevronRight />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={4} className="min-w-48 max-w-64">
        {workspaces.map(workspace => (
          <DropdownMenuItem
            key={workspace.id}
            data-testid={`workspace-${workspace.id}`}
            aria-current={workspace.id === workspaceId ? 'true' : undefined}
            onSelect={() => void choose(workspace.id)}
          >
            {workspace.id === workspaceId ? <Check /> : <span className="w-4" />}
            <span className="truncate">{workspace.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
