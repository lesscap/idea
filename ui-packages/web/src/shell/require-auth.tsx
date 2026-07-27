import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  useCurrentUser,
  useCurrentWorkspaceId,
  useSessionStatus,
} from '../core/session/use-session.ts'

// Guards everything that needs a signed-in user with a workspace selected.
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

  // Signed in but belonging to several workspaces, none chosen yet.
  if (workspaceId === null) return <Navigate to="/workspaces" replace />

  return <>{children}</>
}

// Same, minus the workspace requirement — the workspace picker itself must be
// reachable before one is selected.
export const RequireUser = ({ children }: { children: ReactNode }) => {
  const status = useSessionStatus()
  const user = useCurrentUser()

  if (status === 'loading') return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
