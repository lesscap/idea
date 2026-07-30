import { Navigate, type RouteObject } from 'react-router-dom'
import { AppListPage } from '../features/app/app-list-page'
import { InviteAcceptPage } from '../features/auth/invite-accept-page'
import { LoginPage } from '../features/auth/login-page'
import { UiPreview } from '../ui/preview'
import { RequireAuth } from './require-auth'
import { Shell } from './shell'
import { WorkspaceManagementShell } from './workspace-management-shell'

const guarded = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>

export const routes: RouteObject[] = [
  { path: '/dev/ui', element: <UiPreview /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteAcceptPage /> },
  { path: '/', element: guarded(<Navigate to="/apps" replace />) },
  { path: '/apps', element: guarded(<AppListPage />) },
  { path: '/workspace/*', element: guarded(<WorkspaceManagementShell />) },
  { path: '/apps/:slug/*', element: guarded(<Shell />) },
  { path: '*', element: guarded(<Navigate to="/apps" replace />) },
]
