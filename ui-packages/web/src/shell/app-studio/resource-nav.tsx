import { FileText, House } from 'lucide-react'
import { useLocale } from '../../i18n'
import type { AppStudioWorkspace } from './url/use-app-studio-url'

export const ResourceNav = ({ workspace }: { workspace: AppStudioWorkspace }) => {
  const __ = useLocale()
  const overviewActive = workspace.url.active === 'overview'
  const requirementsActive = workspace.url.active.startsWith('requirements')
  return (
    <aside
      className="hidden w-[220px] shrink-0 flex-col border-border border-r bg-shell min-[1100px]:flex"
      data-testid="studio-resource-nav"
    >
      <nav className="p-2">
        <button
          type="button"
          className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm ${overviewActive ? 'bg-nav-active font-medium' : 'text-foreground/75 hover:bg-nav-hover'}`}
          onClick={() => workspace.open('overview')}
        >
          <House className="size-4 shrink-0" />
          {__('resource.overview')}
        </button>
        <button
          type="button"
          className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm ${requirementsActive ? 'bg-nav-active font-medium' : 'text-foreground/75 hover:bg-nav-hover'}`}
          onClick={() => workspace.open('requirements')}
        >
          <FileText className="size-4 shrink-0" />
          {__('resource.requirements')}
        </button>
      </nav>
    </aside>
  )
}
