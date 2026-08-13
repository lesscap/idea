import type { App } from '@idea/shared'
import { MoreHorizontal, PencilLine, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentRole, useCurrentWorkspaceId } from '../../core/session/use-session'
import { useLocale, useLocaleControl } from '../../i18n'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui'
import { listApps } from './api'
import { DeleteAppDialog } from './delete-app-dialog'
import { RenameAppDialog } from './rename-app-dialog'

export const AppListPage = () => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const workspaceId = useCurrentWorkspaceId()
  const role = useCurrentRole()
  const navigate = useNavigate()
  // Local state, not a store: one consumer, and refetching on mount answers the
  // "when is this stale?" question that a store would leave open.
  const [apps, setApps] = useState<App[] | null>(null)
  const [editing, setEditing] = useState<App | null>(null)
  const [deleting, setDeleting] = useState<App | null>(null)

  // Guarding on workspaceId is not just a lint accommodation: the endpoint reads
  // the workspace from the session, and calling it with none selected is a 400.
  const load = useCallback(() => {
    if (workspaceId === null) return
    listApps()
      .then(page => setApps([...page.items]))
      .catch(error => {
        console.error('Failed to load apps', error)
        setApps([])
      })
  }, [workspaceId])

  // Refetches when the workspace changes — the server scopes this list to
  // whichever one the session has selected, so switching invalidates it.
  useEffect(load, [load])

  // Intl is built into the browser, so following the interface language costs
  // no dependency — and a hardcoded 'zh-CN' would print Chinese-style dates
  // inside an English interface.
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium' }).format(
      new Date(iso),
    )

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas"
      data-testid="apps-page"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-border border-b bg-background px-5 py-5 sm:px-8 sm:py-6">
        <div className="min-w-0">
          <h1 className="text-balance font-semibold text-2xl tracking-[-0.025em]">
            {__('app.heading')}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm">{__('app.subtitle')}</p>
        </div>
        <Button className="shrink-0" data-testid="app-create" onClick={() => navigate('/')}>
          <Plus />
          {__('app.create')}
        </Button>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {apps === null && (
          <p className="text-muted-foreground text-sm" data-testid="apps-loading">
            {__('common.loading')}
          </p>
        )}

        {apps?.length === 0 && (
          <Card className="border-dashed shadow-none">
            <CardHeader>
              <CardTitle>{__('app.empty')}</CardTitle>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-wrap items-stretch gap-5" data-testid="app-list">
          {apps?.map(app => (
            <div key={app.id} className="relative w-full md:w-[26rem] xl:w-[30rem]">
              <Link
                className="block h-full"
                to={`/apps/${encodeURIComponent(app.slug)}/dashboard/overview`}
              >
                <Card
                  className="flex h-full min-h-56 flex-col shadow-none transition-colors hover:border-foreground/25"
                  data-testid="app-card"
                  data-app-slug={app.slug}
                  data-status={app.status}
                >
                  <CardHeader className="p-6 pb-4">
                    <div className="mb-7 flex items-center gap-3 pr-8">
                      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-foreground font-semibold text-background text-lg">
                        {app.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">{app.name}</CardTitle>
                        <span className="mt-1 block truncate text-muted-foreground text-xs">
                          /{app.slug}
                        </span>
                      </div>
                    </div>
                    {app.description && (
                      <CardDescription className="line-clamp-2 max-w-[62ch] leading-relaxed">
                        {app.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto border-border border-t p-6 py-4 text-muted-foreground text-xs">
                    {__('app.createdAt', formatDate(app.createdAt))}
                  </CardContent>
                </Card>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 z-10"
                    aria-label={__('app.actions', app.name)}
                    data-testid={`app-actions-${app.slug}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(app)}>
                    <PencilLine />
                    {__('app.rename')}
                  </DropdownMenuItem>
                  {role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={() => setDeleting(app)}
                      >
                        <Trash2 />
                        {__('app.delete')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <RenameAppDialog
          app={editing}
          open
          onOpenChange={open => !open && setEditing(null)}
          onUpdated={updated =>
            setApps(current => current?.map(app => (app.id === editing.id ? updated : app)) ?? null)
          }
        />
      )}

      {deleting && (
        <DeleteAppDialog
          app={deleting}
          open
          onOpenChange={open => !open && setDeleting(null)}
          onDeleted={appId => setApps(current => current?.filter(app => app.id !== appId) ?? null)}
        />
      )}
    </main>
  )
}
