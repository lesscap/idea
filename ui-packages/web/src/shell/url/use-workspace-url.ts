import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildWorkspaceUrl,
  closeTab,
  openTab,
  parseWorkspaceUrl,
  type WorkspaceUrl,
} from './workspace-url'

// The Shell calls this once and hands the result down as props. Keeping the
// subscription in one place makes the data flow visible, and leaves the panels
// below as plain components — a conversation panel that read the location itself
// would re-render on every tab change for a value it never uses.
//
// No store sits behind this on purpose. The URL is already the authoritative
// host; a second copy would have to be kept in step with it, and the back button
// is where that always comes apart.
export const useWorkspaceUrl = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const url = parseWorkspaceUrl(location)

  // push rather than replace, which makes going back the way to undo closing a
  // tab. Panel widths live in localStorage precisely so they cannot fill this
  // history with entries nobody wants to step through.
  const go = (next: WorkspaceUrl) => navigate(buildWorkspaceUrl(next))

  return {
    url,
    open: (ref: string) => go(openTab(url, ref)),
    close: (ref: string) => go(closeTab(url, ref)),
    showConversation: (conversationId: string | null) => go({ ...url, conversationId }),
  }
}

export type Workspace = ReturnType<typeof useWorkspaceUrl>
