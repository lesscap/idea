import { Navigate, type RouteObject, useParams } from 'react-router-dom'
import { AppListPage } from '../features/app/app-list-page'
import { InviteAcceptPage } from '../features/auth/invite-accept-page'
import { LoginPage } from '../features/auth/login-page'
import { UiPreview } from '../ui/preview'
import { AppStudioShell } from './app-studio'
import { RequireAuth } from './require-auth'
import { WorkspaceShell } from './workspace'
import { WorkspaceConversationPage } from './workspace/conversation-page'
import { WorkspaceHome } from './workspace/home'

const guarded = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>

const AppStudioEntry = () => {
  const { slug = '' } = useParams()
  return <Navigate to={`/apps/${encodeURIComponent(slug)}/dashboard/overview`} replace />
}

const LegacyAppConversation = () => {
  const { slug = '', cid = '' } = useParams()
  const target = `/apps/${encodeURIComponent(slug)}/dashboard/overview?cid=${encodeURIComponent(cid)}`
  return <Navigate to={target} replace />
}

export const routes: RouteObject[] = [
  { path: '/dev/ui', element: <UiPreview /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteAcceptPage /> },
  {
    path: '/',
    element: guarded(<WorkspaceShell />),
    children: [
      { index: true, element: <WorkspaceHome /> },
      { path: 'apps', element: <AppListPage /> },
      { path: 'conversations/:cid', element: <WorkspaceConversationPage /> },
    ],
  },
  { path: '/apps/:slug', element: guarded(<AppStudioEntry />) },
  { path: '/apps/:slug/conversation/:cid', element: guarded(<LegacyAppConversation />) },
  { path: '/apps/:slug/dashboard/*', element: guarded(<AppStudioShell />) },
  { path: '*', element: guarded(<Navigate to="/" replace />) },
]
