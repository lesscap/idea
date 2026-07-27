import { X } from 'lucide-react'
import { useLocale } from '../../i18n'
import { matchResource } from '../resources'
import type { Workspace } from '../url/use-workspace-url'

// Reads the open set straight off the URL. Nothing here holds state: which tabs
// exist and which one is active are both answered by the address bar, so a tab
// strip rebuilt from a pasted link is identical to the one it was copied from.
export const TabBar = ({ workspace }: { workspace: Workspace }) => {
  const __ = useLocale()
  const { url, open, close } = workspace

  if (url.tabs.length === 0) return null

  return (
    <div
      className="flex min-w-0 items-stretch overflow-x-auto"
      data-testid="tab-bar"
      data-tab-count={url.tabs.length}
    >
      {url.tabs.map(ref => {
        const matched = matchResource(ref)
        const active = ref === url.active
        const Icon = matched?.def.icon

        return (
          <div
            key={ref}
            className={`group flex shrink-0 items-center gap-1.5 border-border border-r pr-1 pl-3 text-sm ${
              active ? 'bg-background' : 'text-muted-foreground hover:bg-background/50'
            }`}
            data-testid={`tab-${ref}`}
            data-active={active}
            // Middle-click closes, the way it does on every other tab strip.
            onAuxClick={event => {
              if (event.button === 1) close(ref)
            }}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 py-2 [&_svg]:size-4 [&_svg]:shrink-0"
              onClick={() => open(ref)}
            >
              {Icon && <Icon />}
              {matched ? matched.def.title(__, matched.params) : ref}
            </button>
            <button
              type="button"
              className="rounded p-1 opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100 [&_svg]:size-3.5"
              data-testid={`tab-close-${ref}`}
              aria-label={__('shell.closeTab')}
              onClick={() => close(ref)}
            >
              <X />
            </button>
          </div>
        )
      })}
    </div>
  )
}
