import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildWorkspaceUrl,
  closeTab,
  openTab,
  parseWorkspaceUrl,
  showConversation,
  showHome,
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
  const draftScope = url.conversationId === 'new' ? url.slug : null
  const draftToken = useMemo(() => (draftScope === null ? null : Symbol(draftScope)), [draftScope])
  const latest = useRef({ url, draftToken })
  const mounted = useRef(false)
  latest.current = { url, draftToken }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // push rather than replace, which makes going back the way to undo closing a
  // tab. Panel widths live in localStorage precisely so they cannot fill this
  // history with entries nobody wants to step through.
  const go = (next: WorkspaceUrl, replace = false) => navigate(buildWorkspaceUrl(next), { replace })

  return {
    url,
    open: (ref: string) => go(openTab(url, ref)),
    close: (ref: string) => go(closeTab(url, ref)),
    home: () => go(showHome(url)),
    showConversation: (conversationId: string | null) => go(showConversation(url, conversationId)),
    replaceConversation: (conversationId: string) => {
      const current = latest.current
      if (!mounted.current || draftToken === null || current.draftToken !== draftToken) return
      go({ ...current.url, conversationId }, true)
    },
  }
}

export type Workspace = ReturnType<typeof useWorkspaceUrl>
