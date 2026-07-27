import { useState } from 'react'
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelCallbackRef,
} from 'react-resizable-panels'
import { useCurrentRole, useCurrentUser, useCurrentWorkspaceId } from '../core/session/use-session'
import { ConversationPanel } from '../features/conversation/conversation-panel'
import { useLocaleControl } from '../i18n'
import { ContentColumn } from './content'
import { SideColumn } from './side'
import { useWorkspaceUrl } from './url/use-workspace-url'
import { useSideCollapsed } from './use-side-collapsed'

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
  const [sideCollapsed, toggleSide] = useSideCollapsed()
  const [conversationHandle, conversationRef] = usePanelCallbackRef()
  const [conversationCollapsed, setConversationCollapsed] = useState(false)
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
      data-locale={locale}
      data-active={url.active ?? ''}
      data-tab-count={url.tabs.length}
      data-conversation-id={url.conversationId ?? ''}
    >
      <SideColumn workspace={workspace} collapsed={sideCollapsed} onToggle={toggleSide} />

      <Group
        orientation="horizontal"
        className="min-h-0 min-w-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="conversation"
          defaultSize="340px"
          minSize="260px"
          collapsible
          collapsedSize={0}
          groupResizeBehavior="preserve-pixel-size"
          panelRef={conversationRef}
          // One-way: the panel reports its size, and that is the only source of
          // "is it collapsed". Mirroring it into an intent flag is what makes the
          // two disagree and forces a sync effect to referee them.
          onResize={size => setConversationCollapsed(size.inPixels < 1)}
          className="flex min-h-0 min-w-0 flex-col"
        >
          <ConversationPanel
            conversationId={url.conversationId}
            context={url.active}
            onCollapse={() => conversationHandle?.collapse()}
          />
        </Panel>

        <Separator className="-mx-[3px] relative z-10 w-[7px] cursor-col-resize transition-colors hover:bg-accent/20" />

        <Panel id="content" minSize="320px" className="flex min-h-0 min-w-0 flex-col">
          <ContentColumn
            workspace={workspace}
            conversationCollapsed={conversationCollapsed}
            onExpandConversation={() => conversationHandle?.expand()}
          />
        </Panel>
      </Group>
    </div>
  )
}
