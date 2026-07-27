import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@idea/design'
import { ChevronDown, LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser, useCurrentWorkspaceId, useSignOut } from '../core/session/use-session.ts'
import { InviteDialog } from '../features/workspace/invite-dialog.tsx'
import { WorkspaceSwitcher } from './workspace-switcher.tsx'

// The signed-in frame. Composition across features happens here — the workspace
// switcher and the invite dialog belong to different features and are wired
// together in the shell rather than either one importing the other.
export const AppLayout = () => {
  const user = useCurrentUser()
  const workspaceId = useCurrentWorkspaceId()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [inviting, setInviting] = useState(false)

  const leave = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold">idea</span>
            <WorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setInviting(true)}>
              <UserPlus />
              邀请成员
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {user?.name}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  {user?.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={leave}>
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>

      {workspaceId !== null && (
        <InviteDialog workspaceId={workspaceId} open={inviting} onOpenChange={setInviting} />
      )}
    </div>
  )
}
