import { ArrowLeft, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n'

export const WorkspaceManagementShell = () => {
  const __ = useLocale()

  return (
    <div className="flex h-dvh bg-background text-foreground" data-testid="workspace-management">
      <aside className="flex w-56 shrink-0 flex-col border-border border-r bg-muted/20 p-2">
        <h1 className="px-2 py-2 font-semibold text-sm">{__('workspace.management')}</h1>
        <nav className="mt-2">
          <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-sm">
            <Users className="size-4" />
            {__('resource.members')}
          </div>
        </nav>
        <Link
          to="/apps"
          className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground text-sm hover:bg-background"
        >
          <ArrowLeft className="size-4" />
          {__('workspace.backToWorkbench')}
        </Link>
      </aside>
      <main className="flex min-w-0 flex-1 items-center justify-center p-6 text-muted-foreground text-sm">
        {__('workspace.membersPlaceholder')}
      </main>
    </div>
  )
}
