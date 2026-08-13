import { LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCurrentRole,
  useCurrentUser,
  useCurrentWorkspaceId,
  useSignOut,
} from '../../core/session/use-session'
import { InviteDialog } from '../../features/workspace/invite-dialog'
import { useLocale } from '../../i18n'
import { LocaleMenu } from '../../parts/locale-switch'
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui'
import { WorkspaceSwitcher } from './workspace-switcher'

export const AccountMenu = ({
  compact = false,
  placement,
}: {
  compact?: boolean
  placement: 'sidebar' | 'header'
}) => {
  const __ = useLocale()
  const user = useCurrentUser()
  const workspaceId = useCurrentWorkspaceId()
  const role = useCurrentRole()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [inviting, setInviting] = useState(false)

  const leave = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={compact ? 'size-9 p-0' : 'h-10 min-w-0 justify-start gap-2 px-2'}
            data-testid="user-menu"
            aria-label={compact ? (user?.name ?? user?.username) : undefined}
          >
            <Avatar name={user?.name ?? '?'} seed={user?.username ?? ''} className="size-7" />
            {!compact && <span className="truncate">{user?.name}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={placement === 'sidebar' ? 'start' : 'end'}
          side={placement === 'sidebar' ? 'top' : 'bottom'}
          className="min-w-52 max-w-64"
        >
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {user?.username}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <WorkspaceSwitcher />
          {role === 'admin' && (
            <DropdownMenuItem data-testid="menu-invite" onSelect={() => setInviting(true)}>
              <UserPlus />
              {__('invite.title')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <LocaleMenu />
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="menu-signout" onSelect={() => void leave()}>
            <LogOut />
            {__('auth.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {workspaceId !== null && (
        <InviteDialog workspaceId={workspaceId} open={inviting} onOpenChange={setInviting} />
      )}
    </>
  )
}
