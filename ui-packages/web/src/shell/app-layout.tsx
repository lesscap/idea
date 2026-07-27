import { LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  useCurrentRole,
  useCurrentUser,
  useCurrentWorkspaceId,
  useSignOut,
} from '../core/session/use-session.ts'
import { InviteDialog } from '../features/workspace/invite-dialog.tsx'
import { useLocale, useLocaleControl } from '../i18n/index.tsx'
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/index.ts'
import { LocaleSwitch } from './locale-switch.tsx'
import { WorkspaceSwitcher } from './workspace-switcher.tsx'

// The signed-in frame. Composition across features happens here — the workspace
// switcher and the invite dialog belong to different features and are wired
// together in the shell rather than either one importing the other.
export const AppLayout = () => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
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
    // Session context published on the DOM so automation can read the whole
    // situation in one go instead of inferring it from what happens to be on
    // screen. Only non-sensitive identifiers — never tokens or contact details.
    <div
      className="min-h-screen bg-muted/20"
      data-testid="app-shell"
      data-username={user?.username}
      data-role={role ?? 'none'}
      data-workspace-id={workspaceId ?? ''}
      data-locale={locale}
    >
      <header className="border-b border-border bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold">idea</span>
            <WorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-1">
            {/* Language is one click from anywhere, the way it works on most
                sites. Invite stays inside the account menu instead: it is
                low-frequency and admin-only, which does not earn permanent
                space in the header. */}
            <LocaleSwitch />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2" data-testid="user-menu">
                  <Avatar name={user?.name ?? '?'} seed={user?.username ?? ''} />
                  {user?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
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
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        <Outlet />
      </main>

      {workspaceId !== null && (
        <InviteDialog workspaceId={workspaceId} open={inviting} onOpenChange={setInviting} />
      )}
    </div>
  )
}
