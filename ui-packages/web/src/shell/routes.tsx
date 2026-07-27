import type { RouteObject } from 'react-router-dom'
import { AppListPage } from '../features/app/app-list-page.tsx'
import { InviteAcceptPage } from '../features/auth/invite-accept-page.tsx'
import { LoginPage } from '../features/auth/login-page.tsx'
import { UiPreview } from '../ui/preview/index.tsx'
import { AppLayout } from './app-layout.tsx'
import { RequireAuth } from './require-auth.tsx'

// Reads as the access policy: public routes first, then everything behind
// sign-in.
export const routes: RouteObject[] = [
  // Ships in production too, so it stays a plain static import. "dev" here names
  // the audience — developers and designers checking primitives — not the
  // environment. It touches no API and exposes nothing, and the ~4 kB it adds is
  // not worth the environment-conditional machinery required to strip it.
  { path: '/dev/ui', element: <UiPreview /> },
  { path: '/login', element: <LoginPage /> },
  // Public: whoever holds the link has no account yet, so it cannot be guarded.
  { path: '/invite/:token', element: <InviteAcceptPage /> },
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
