import { useRef } from 'react'
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
  const latestUrl = useRef(url)
  latestUrl.current = url

  // push rather than replace, which makes going back the way to undo closing a
  // tab. Panel widths live in localStorage precisely so they cannot fill this
  // history with entries nobody wants to step through.
  const go = (next: WorkspaceUrl, replace = false) => navigate(buildWorkspaceUrl(next), { replace })

  return {
    url,
    open: (ref: string) => go(openTab(url, ref)),
    close: (ref: string) => go(closeTab(url, ref)),
    showConversation: (conversationId: string | null) => go({ ...url, conversationId }),
    replaceConversation: (conversationId: string) => {
      // The request can finish after the person has moved to another tab or
      // conversation. Keep their latest resource state, and never let a stale
      // draft completion take over a conversation they selected meanwhile.
      const latest = latestUrl.current
      if (latest.conversationId !== 'new') return
      go({ ...latest, conversationId }, true)
    },
  }
}

export type Workspace = ReturnType<typeof useWorkspaceUrl>
