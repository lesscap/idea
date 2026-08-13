import type { App } from '@idea/shared'
import { useEffect, useMemo, useState } from 'react'
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelCallbackRef,
} from 'react-resizable-panels'
import { Link } from 'react-router-dom'
import { useStudioChat } from '../../core/layout/use-layout'
import { getAppBySlug } from '../../features/app/api'
import { latestConversation } from '../../features/conversation/api'
import type { ConversationScope } from '../../features/conversation/scope'
import { fileResourceRef } from '../../features/file/api'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { ChatColumn } from './chat-column'
import { ContentColumn } from './content'
import { AppStudioContentHeader } from './header'
import { ResourceNav } from './resource-nav'
import { useAppStudioUrl } from './url/use-app-studio-url'

const STUDIO_LAYOUT_ID = 'idea.studio.layout'
const STUDIO_PANEL_IDS = ['studio-chat', 'studio-content']

const useMobileLayout = (): boolean => {
  const [mobile, setMobile] = useState(
    () => globalThis.matchMedia?.('(max-width: 767px)').matches ?? false,
  )
  useEffect(() => {
    const media = globalThis.matchMedia('(max-width: 767px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

export const AppStudioShell = () => {
  const __ = useLocale()
  const workspace = useAppStudioUrl()
  const { url } = workspace
  const [app, setApp] = useState<App | null | undefined>(undefined)
  const [entryError, setEntryError] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useStudioChat()
  const [chatHandle, chatRef] = usePanelCallbackRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: STUDIO_LAYOUT_ID,
    panelIds: STUDIO_PANEL_IDS,
    onlySaveAfterUserInteractions: true,
  })
  const mobile = useMobileLayout()
  const scope = useMemo<ConversationScope | null>(
    () => (app ? { type: 'app', appId: app.id } : null),
    [app],
  )

  useEffect(() => {
    let active = true
    setApp(undefined)
    getAppBySlug(url.slug)
      .then(found => active && setApp(found))
      .catch(error => {
        console.error('app load failed', error)
        if (active) setApp(null)
      })
    return () => {
      active = false
    }
  }, [url.slug])

  useEffect(() => {
    if (!scope || url.conversationId !== null) return
    let active = true
    setEntryError(false)
    latestConversation(scope)
      .then(cid => active && workspace.replaceConversation(cid ?? 'new'))
      .catch(error => {
        console.error('latest conversation failed', error)
        if (active) setEntryError(true)
      })
    return () => {
      active = false
    }
  }, [scope, url.conversationId, workspace])

  useEffect(() => {
    if (!chatHandle) return
    if (chatCollapsed && !chatHandle.isCollapsed()) chatHandle.collapse()
    else if (!chatCollapsed && chatHandle.isCollapsed()) chatHandle.expand()
  }, [chatCollapsed, chatHandle])

  if (app === undefined) return <div className="h-dvh animate-pulse bg-canvas" />
  if (app === null)
    return (
      <div className="grid h-dvh place-items-center bg-canvas">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">{__('shell.appNotFound')}</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/apps">{__('shell.backToApps')}</Link>
          </Button>
        </div>
      </div>
    )
  if (scope === null) return null

  const chat = (
    <ChatColumn
      app={app}
      scope={scope}
      conversationId={url.conversationId}
      entryError={entryError}
      onConversation={workspace.showConversation}
      onConversationCreated={workspace.replaceConversation}
      onCollapse={() => setChatCollapsed(true)}
      onOpenFile={file => workspace.open(fileResourceRef(file))}
      onRetry={() => window.location.reload()}
    />
  )
  const content = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AppStudioContentHeader
        workspace={workspace}
        chatCollapsed={chatCollapsed}
        onExpandChat={() => setChatCollapsed(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <ResourceNav workspace={workspace} />
        <ContentColumn workspace={workspace} app={app} />
      </div>
    </div>
  )

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background text-foreground"
      data-testid="app-studio-shell"
    >
      {mobile ? (
        chatCollapsed ? (
          content
        ) : (
          chat
        )
      ) : (
        <Group
          id={STUDIO_LAYOUT_ID}
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="min-h-0 min-w-0 flex-1"
        >
          <Panel
            id="studio-chat"
            defaultSize="30"
            minSize={320}
            collapsible
            collapsedSize={0}
            panelRef={chatRef}
            inert={chatCollapsed}
            aria-hidden={chatCollapsed}
            className="flex min-h-0 min-w-0 flex-col"
            onResize={(size, _, previous) =>
              previous !== undefined && setChatCollapsed(size.inPixels < 1)
            }
          >
            {chat}
          </Panel>
          <Separator className={chatCollapsed ? 'w-0' : 'w-px bg-border hover:bg-brand'} />
          <Panel id="studio-content" minSize={360} className="flex min-h-0 min-w-0 flex-col">
            {content}
          </Panel>
        </Group>
      )}
    </div>
  )
}
