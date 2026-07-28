import { MessageSquare } from 'lucide-react'
import { Activity } from 'react'
import { useLocale } from '../../i18n'
import { matchResource } from '../resources'
import type { Workspace } from '../url/use-workspace-url'
import { TabBar } from './tab-bar'

// Every open tab stays mounted; React's <Activity> hides the inactive ones.
//
// This is why the main area is not an <Outlet/>: a router renders the matched
// route and nothing else, so switching tabs would tear down the one you left.
// Keeping them mounted preserves scroll position, half-typed input and loaded
// data, and React deprioritises rendering the hidden ones — so ten open tabs
// cost about what one costs to work in.
//
// The consequence is the rule in ../resources: content receives params as props.
// A hidden tab calling useParams() would read the *active* route's params rather
// than its own, and nothing would throw.
export const ContentColumn = ({
  workspace,
  hasConversation,
  conversationCollapsed,
  onExpandConversation,
}: {
  workspace: Workspace
  hasConversation: boolean
  conversationCollapsed: boolean
  onExpandConversation: () => void
}) => {
  const __ = useLocale()
  const { url } = workspace
  const activeMatch = url.active === null ? null : matchResource(url.active)

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      data-testid="content-column"
      data-active={url.active ?? ''}
      data-tab-count={url.tabs.length}
    >
      {((hasConversation && conversationCollapsed) || url.tabs.length > 0) && (
        <div className="flex h-10 shrink-0 items-stretch border-border border-b bg-muted/30">
          {/* Dragging the separator all the way in leaves no way back on screen.
              This is that way back. */}
          {hasConversation && conversationCollapsed && (
            <button
              type="button"
              className="px-2 text-muted-foreground hover:bg-background [&_svg]:size-4"
              data-testid="conversation-expand"
              aria-label={__('shell.expandConversation')}
              onClick={onExpandConversation}
            >
              <MessageSquare />
            </button>
          )}
          <TabBar workspace={workspace} />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {url.tabs.map(ref => {
          const matched = matchResource(ref)
          if (!matched) return null
          const { Content } = matched.def

          return (
            <Activity key={ref} mode={ref === url.active ? 'visible' : 'hidden'} name={ref}>
              {/* Each tab scrolls on its own. Sharing one scroll container would
                  throw away the position that keeping it mounted just saved. */}
              <div className="absolute inset-0 overflow-auto">
                <Content params={matched.params} />
              </div>
            </Activity>
          )
        })}

        {url.active === null && (
          <p
            className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
            data-testid="content-empty"
          >
            {__('shell.emptyMain')}
          </p>
        )}

        {url.active !== null && activeMatch === null && (
          <p
            className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
            data-testid="content-unknown"
          >
            {__('shell.unknownResource', url.active)}
          </p>
        )}
      </div>
    </div>
  )
}
