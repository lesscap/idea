import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  type AppStudioUrl,
  buildAppStudioUrl,
  closeTab,
  openTab,
  parseAppStudioUrl,
  showConversation,
} from './app-studio-url'

export const useAppStudioUrl = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { pathname, search } = location
  const url = useMemo(() => parseAppStudioUrl({ pathname, search }), [pathname, search])
  const go = useCallback(
    (next: AppStudioUrl, replace = false) => navigate(buildAppStudioUrl(next), { replace }),
    [navigate],
  )
  return useMemo(
    () => ({
      url,
      open: (ref: string) => go(openTab(url, ref)),
      close: (ref: string) => go(closeTab(url, ref)),
      showConversation: (id: string) => go(showConversation(url, id)),
      replaceConversation: (id: string) => go(showConversation(url, id), true),
    }),
    [go, url],
  )
}

export type AppStudioWorkspace = ReturnType<typeof useAppStudioUrl>
