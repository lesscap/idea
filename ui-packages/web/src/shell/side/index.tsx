import { PanelLeft, PanelLeftOpen, SquarePen } from 'lucide-react'
import { ConversationList } from '../../features/conversation/conversation-list'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { RESOURCES, type ResourceKind } from '../resources'
import type { Workspace } from '../url/use-workspace-url'
import { Identity } from './identity'

// Which resources get a permanent entry, in order. Kept as an explicit list
// rather than derived from RESOURCES: detail routes are registered there too and
// have nothing to point at until something is selected, so deriving would need a
// flag that exists only to undo the derivation.
//
// Every entry must be a parameterless path — the ref below is the pattern with
// its slash stripped, so listing 'requirement' (/requirements/:code) would open
// a tab literally called `requirements/:code`.
const NAV: ResourceKind[] = ['requirements', 'apps', 'members', 'settings']

export const SideColumn = ({
  workspace,
  collapsed,
  onToggle,
  onShowConversation,
}: {
  workspace: Workspace
  collapsed: boolean
  onToggle: () => void
  onShowConversation: (id: string) => void
}) => {
  const __ = useLocale()
  const { url, open } = workspace

  return (
    <div
      className={`flex shrink-0 flex-col border-border border-r bg-muted/20 ${
        collapsed ? 'w-12' : 'w-56'
      }`}
      data-testid="side-column"
      data-collapsed={collapsed}
    >
      <div className="flex h-10 shrink-0 items-center justify-between px-2">
        {!collapsed && <span className="pl-1 font-semibold text-sm">idea</span>}
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          data-testid="side-toggle"
          aria-label={__(collapsed ? 'shell.expandSide' : 'shell.collapseSide')}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeft />}
        </Button>
      </div>

      <button
        type="button"
        className={`mx-2 mb-1 flex h-9 items-center rounded-md text-sm transition-colors hover:bg-background ${
          collapsed ? 'w-8 justify-center' : 'gap-2 px-2'
        } ${url.conversationId === 'new' ? 'bg-background font-medium' : ''}`}
        data-testid="conversation-new"
        data-active={url.conversationId === 'new'}
        // The label is always there, because collapsed this is an icon with no
        // text beside it. `title` is the hover hint, not a substitute.
        aria-label={__('shell.newConversation')}
        title={collapsed ? __('shell.newConversation') : undefined}
        onClick={() => onShowConversation('new')}
      >
        <SquarePen className="size-4 shrink-0" />
        {!collapsed && <span>{__('shell.newConversation')}</span>}
      </button>

      <nav className="flex flex-col gap-0.5 p-2" data-testid="side-nav">
        {NAV.map(kind => {
          const def = RESOURCES[kind]
          const ref = def.path.slice(1)
          const Icon = def.icon
          const active = url.active === ref

          return (
            <button
              key={kind}
              type="button"
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4 [&_svg]:shrink-0 ${
                active
                  ? 'bg-background font-medium'
                  : 'text-muted-foreground hover:bg-background/60'
              } ${collapsed ? 'justify-center' : ''}`}
              data-testid={`nav-${kind}`}
              data-active={active}
              title={collapsed ? def.title(__, {}) : undefined}
              onClick={() => open(ref)}
            >
              <Icon />
              {!collapsed && def.title(__, {})}
            </button>
          )
        })}
      </nav>

      {!collapsed && (
        <ConversationList conversationId={url.conversationId} onSelect={onShowConversation} />
      )}

      <Identity collapsed={collapsed} />
    </div>
  )
}
