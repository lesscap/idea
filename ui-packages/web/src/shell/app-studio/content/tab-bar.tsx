import { X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { useLocale } from '../../../i18n'
import { matchResource } from '../resources'
import type { AppStudioWorkspace } from '../url/use-app-studio-url'

export const TabBar = ({ workspace }: { workspace: AppStudioWorkspace }) => {
  const __ = useLocale()
  const { url, open, close } = workspace
  const activeTab = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (url.active === 'overview') return
    activeTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [url.active])

  const tabs = url.tabs.filter(ref => ref !== 'overview')

  return (
    <div className="flex min-w-0 items-stretch overflow-x-auto" data-testid="tab-bar">
      {tabs.map(ref => {
        const matched = matchResource(ref)
        const active = ref === url.active
        const Icon = matched?.def.icon
        const title = matched ? matched.def.title(__, matched.params) : ref
        return (
          <div
            key={ref}
            ref={active ? activeTab : undefined}
            className={`group flex shrink-0 items-center gap-1.5 border-border border-r pr-1 pl-3 text-sm ${
              active ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-nav-hover'
            }`}
            onAuxClick={event => event.button === 1 && close(ref)}
          >
            <button
              type="button"
              className="flex max-w-56 items-center gap-1.5 py-2"
              onClick={() => open(ref)}
            >
              {Icon && <Icon className="size-4 shrink-0" />}
              <span className="truncate" title={title}>
                {title}
              </span>
            </button>
            <button
              type="button"
              className="rounded p-1 opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={__('shell.closeTab')}
              onClick={() => close(ref)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
