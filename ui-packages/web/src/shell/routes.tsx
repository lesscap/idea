import { Navigate, type RouteObject, useParams } from 'react-router-dom'
import { InviteAcceptPage } from '../features/auth/invite-accept-page'
import { LoginPage } from '../features/auth/login-page'
import { UiPreview } from '../ui/preview'
import { RequireAuth } from './require-auth'
import { Shell } from './shell'

// Conversation identity has exactly one home, `?cid=`. This entry exists because
// /conversations/42 is the natural thing to type or paste, but it redirects
// rather than being a route in its own right: two places to read a conversation
// id from are two places that can disagree, and /conversations/42?cid=99 would
// have no defensible answer.
const ConversationEntry = () => {
  const { id } = useParams()
  return <Navigate to={`/?cid=${encodeURIComponent(id ?? '')}`} replace />
}

// Reads as the access policy: public routes first, then everything behind
// sign-in.
//
// The Shell takes '*' rather than declaring a route per resource. Resource
// routing lives in ./resources, which the Shell reads to render every open tab;
// an Outlet renders only the matched route, so it cannot keep the rest mounted.
// One registry also beats a route table that has to be kept in step with it.
export const routes: RouteObject[] = [
  // Ships in production too, so it stays a plain static import. "dev" here names
  // the audience — developers and designers checking primitives — not the
  // environment. It touches no API and exposes nothing, and the ~4 kB it adds is
  // not worth the environment-conditional machinery required to strip it.
  { path: '/dev/ui', element: <UiPreview /> },
  { path: '/login', element: <LoginPage /> },
  // Public: whoever holds the link has no account yet, so it cannot be guarded.
  { path: '/invite/:token', element: <InviteAcceptPage /> },
  { path: '/conversations/:id', element: <ConversationEntry /> },
  {
    path: '*',
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
  },
]
