import type { RouteObject } from 'react-router-dom'
import { AppListPage } from '../features/app/app-list-page.tsx'
import { InviteAcceptPage } from '../features/auth/invite-accept-page.tsx'
import { LoginPage } from '../features/auth/login-page.tsx'
import { WorkspaceSelectPage } from '../features/workspace/workspace-select-page.tsx'
import { AppLayout } from './app-layout.tsx'
import { RequireAuth, RequireUser } from './require-auth.tsx'

// Reads as the access policy: public routes first, then the ones needing a user,
// then the ones needing a user with a workspace selected.
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  // Public: whoever holds the link has no account yet, so it cannot be guarded.
  { path: '/invite/:token', element: <InviteAcceptPage /> },
  {
    path: '/workspaces',
    element: (
      <RequireUser>
        <WorkspaceSelectPage />
      </RequireUser>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [{ index: true, element: <AppListPage /> }],
  },
]
