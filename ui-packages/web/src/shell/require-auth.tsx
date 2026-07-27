import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  useCurrentUser,
  useCurrentWorkspaceId,
  useSessionStatus,
} from '../core/session/use-session.ts'
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/index.ts'

// Guards everything behind sign-in.
//
// Rendering nothing while `loading` matters: without it, the first paint after a
// refresh sees `user === null` and bounces an authenticated user to the login
// screen before the session request has answered.
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useSessionStatus()
  const user = useCurrentUser()
  const workspaceId = useCurrentWorkspaceId()
  const location = useLocation()

  if (status === 'loading') return null

  if (!user) {
    // Remember where they were headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Signing in always resolves a workspace, so reaching here without one means
  // exactly one thing: this person belongs to no workspace at all. There is
  // nothing for them to pick, so say what happened instead of showing an empty
  // chooser.
  if (workspaceId === null) return <NoWorkspace />

  return <>{children}</>
}

const NoWorkspace = () => (
  <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>你还不属于任何工作空间</CardTitle>
        <CardDescription>请联系管理员邀请你加入。收到邀请链接后打开即可进入。</CardDescription>
      </CardHeader>
    </Card>
  </div>
)
