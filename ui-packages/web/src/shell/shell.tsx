import type { App } from '@idea/shared'
import { useEffect, useLayoutEffect, useState } from 'react'
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelCallbackRef,
} from 'react-resizable-panels'
import { Link } from 'react-router-dom'
import {
  useConversationCollapsed,
  useSetConversationCollapsed,
  useSideCollapsed,
  useToggleSide,
} from '../core/layout/use-layout'
import { useCurrentRole, useCurrentUser, useCurrentWorkspaceId } from '../core/session/use-session'
import { getAppBySlug } from '../features/app/api'
import { ConversationPanel } from '../features/conversation/conversation-panel'
import { fileResourceRef } from '../features/file/api'
import { useLocale, useLocaleControl } from '../i18n'
import { Button } from '../ui'
import { ContentColumn } from './content'
import { SideColumn } from './side'
import { useWorkspaceUrl } from './url/use-workspace-url'

// side ｜ conversation ｜ content. The three are orthogonal: the path says which
// resource fills the main area, `?cid=` says which conversation is attached, and
// neither owns the other. A conversation senses what you are looking at without
// belonging to it.
//
// The Group and both Panels are rendered unconditionally, even with no
// conversation selected. Wrapping them in a condition would move ContentColumn
// within the tree whenever a conversation opened or closed, remounting it and
// discarding every tab's state — the exact loss this layout exists to prevent,
// arriving through a side door.
export const Shell = () => {
  const workspace = useWorkspaceUrl()
  const __ = useLocale()
  const [app, setApp] = useState<App | null | undefined>(undefined)
  const sideCollapsed = useSideCollapsed()
  const toggleSide = useToggleSide()
  const conversationCollapsed = useConversationCollapsed()
  const setConversationCollapsed = useSetConversationCollapsed()
  const [conversationHandle, conversationRef] = usePanelCallbackRef()
  // Panel widths persist themselves; nothing here has to watch or store them.
  //
  // onlySaveAfterUserInteractions keeps constraint recomputes and mount-time
  // layout out of storage, at the price of one asymmetry worth knowing: dragging
  // the separator shut is remembered across reloads, while the collapse button
  // is not, because a programmatic collapse is not an interaction the library
  // can attribute. Reopening on reload is the safe direction to be wrong in.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'idea.shell',
    onlySaveAfterUserInteractions: true,
  })

  const { locale } = useLocaleControl()
  const user = useCurrentUser()
  const workspaceId = useCurrentWorkspaceId()
  const role = useCurrentRole()
  const { url } = workspace
  const hasConversation = url.conversationId !== null
  const conversationHidden = !hasConversation || conversationCollapsed

  // Paint-blocking on purpose. The panel handle exists only after commit, while
  // its first rendered width can disagree with the URL/store. Synchronising
  // before paint prevents a blank 340px conversation column flashing on entry.
  // URL presence and layout preference remain independent: hiding for no cid
  // never overwrites the remembered preference.
  useLayoutEffect(() => {
    if (!conversationHandle) return
    if (conversationHidden && !conversationHandle.isCollapsed()) conversationHandle.collapse()
    else if (!conversationHidden && conversationHandle.isCollapsed()) conversationHandle.expand()
  }, [conversationHandle, conversationHidden])

  useEffect(() => {
    let current = true
    setApp(undefined)
    getAppBySlug(url.slug)
      .then(found => {
        if (current) setApp(found)
      })
      .catch(() => {
        if (current) setApp(null)
      })
    return () => {
      current = false
    }
  }, [url.slug])

  if (app === undefined) return null
  if (app === null)
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted-foreground text-sm">{__('shell.appNotFound')}</p>
          <Button asChild variant="outline">
            <Link to="/apps">{__('shell.backToApps')}</Link>
          </Button>
        </div>
      </div>
    )

  const showConversation = (id: string) => {
    setConversationCollapsed(false)
    workspace.showConversation(id)
  }

  return (
    // The whole situation published on one element so automation can read it in
    // a single `dataset` lookup rather than inferring it from what is on screen.
    // Non-sensitive identifiers only — never tokens or contact details.
    <div
      className="flex h-dvh overflow-hidden bg-background text-foreground"
      data-testid="app-shell"
      data-username={user?.username}
      data-role={role ?? 'none'}
      data-workspace-id={workspaceId ?? ''}
      data-app-slug={app.slug}
      data-locale={locale}
      data-active={url.active ?? ''}
      data-tab-count={url.tabs.length}
      data-conversation-id={url.conversationId ?? ''}
    >
      <SideColumn
        workspace={workspace}
        app={app}
        collapsed={sideCollapsed}
        onToggle={toggleSide}
        onShowConversation={showConversation}
      />

      <Group
        orientation="horizontal"
        className="min-h-0 min-w-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={(layout, meta) => {
          if (
            meta.isUserInteraction &&
            hasConversation &&
            conversationHandle &&
            !conversationHandle.isCollapsed()
          )
            onLayoutChanged(layout, meta)
        }}
      >
        <Panel
          id="conversation"
          hidden={conversationHidden}
          defaultSize="340px"
          minSize="260px"
          collapsible
          collapsedSize={0}
          groupResizeBehavior="preserve-pixel-size"
          panelRef={conversationRef}
          // This used to be one-way: the panel's own size was the only source of
          // "is it collapsed", precisely so there was nothing to keep in step.
          // Two requirements broke that. The preference has to survive a reload,
          // and the panel cannot remember it — a fresh mount has no size yet.
          // And it has to stay independent of whether a conversation is open at
          // all, so arriving on a URL without `cid` hides the column without
          // erasing what the person chose.
          //
          // So there is now a stored intent and a rendered size, and they need a
          // referee — the layout effect above. What keeps that from looping is
          // the equality check in useSetConversationCollapsed; see the comment
          // there before touching either side.
          //
          // `previous === undefined` is the panel's first report, which is its
          // constraint-derived size rather than anything the person did.
          //
          // No unit test covers the guard, and one was tried: jsdom has no
          // layout, so a mounted panel never reports a resize and the test
          // passes just as happily with the guard deleted. Faking the report
          // would only assert what the fake was told to say. Check it in a
          // browser — open a conversation, collapse it, navigate to a URL with
          // no `cid`, and come back; the column should still be collapsed.
          onResize={(size, _, previous) => {
            if (!hasConversation || previous === undefined) return
            setConversationCollapsed(size.inPixels < 1)
          }}
          className="flex min-h-0 min-w-0 flex-col"
        >
          <ConversationPanel
            appId={app.id}
            conversationId={url.conversationId}
            hidden={conversationHidden}
            onConversationCreated={workspace.replaceConversation}
            onCollapse={() => setConversationCollapsed(true)}
            onOpenFile={file => workspace.open(fileResourceRef(file))}
          />
        </Panel>

        <Separator
          className={
            conversationHidden
              ? 'pointer-events-none w-0'
              : '-mx-[3px] relative z-10 w-[7px] cursor-col-resize transition-colors hover:bg-accent/20'
          }
        />

        <Panel id="content" minSize="320px" className="flex min-h-0 min-w-0 flex-col">
          <ContentColumn
            workspace={workspace}
            app={app}
            hasConversation={hasConversation}
            conversationCollapsed={conversationCollapsed}
            onExpandConversation={() => setConversationCollapsed(false)}
          />
        </Panel>
      </Group>
    </div>
  )
}
