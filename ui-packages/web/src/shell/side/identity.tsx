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
import { LocaleSwitch } from '../../parts/locale-switch'
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

// Sits at the foot of the rail rather than in a top bar. A full-width header
// existed to carry four controls, while each of the three columns needed its own
// heading anyway — so the bar went and its contents came here, which is where
// every other tool of this shape puts them.
//
// Composition across features happens here: the workspace switcher and the
// invite dialog belong to different features and are wired together by the
// shell, not by either one importing the other.
export const Identity = ({ collapsed }: { collapsed: boolean }) => {
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
    <div className="shrink-0 border-border border-t p-2" data-testid="identity">
      {!collapsed && <WorkspaceSwitcher />}

      <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between'}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2" data-testid="user-menu">
              <Avatar name={user?.name ?? '?'} seed={user?.username ?? ''} />
              {!collapsed && user?.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-44">
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user?.username}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Only administrators may create invites. Showing the entry to
                everyone and letting the server answer 403 turns a permission
                boundary into a dead end found only by walking into it. */}
            {role === 'admin' && (
              <>
                <DropdownMenuItem data-testid="menu-invite" onSelect={() => setInviting(true)}>
                  <UserPlus />
                  {__('invite.title')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem data-testid="menu-signout" onSelect={leave}>
              <LogOut />
              {__('auth.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LocaleSwitch compact={collapsed} />
      </div>

      {workspaceId !== null && (
        <InviteDialog workspaceId={workspaceId} open={inviting} onOpenChange={setInviting} />
      )}
    </div>
  )
}
