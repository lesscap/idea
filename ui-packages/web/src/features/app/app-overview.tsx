import type { App } from '@idea/shared'
import { useMemo } from 'react'
import { useLocale, useLocaleControl } from '../../i18n'

export const AppOverview = ({ app }: { app: App }) => {
  const __ = useLocale()
  const { locale } = useLocaleControl()
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
        dateStyle: 'medium',
      }),
    [locale],
  )
  const statuses = {
    draft: __('app.status.draft'),
    active: __('app.status.active'),
    archived: __('app.status.archived'),
  }
  const details = [
    { label: __('app.name'), value: app.name },
    { label: __('app.slug'), value: `/${app.slug}` },
    { label: __('app.overview.status'), value: statuses[app.status] },
    { label: __('app.overview.created'), value: formatDate.format(new Date(app.createdAt)) },
    { label: __('app.overview.updated'), value: formatDate.format(new Date(app.updatedAt)) },
  ]

  return (
    <main className="h-full overflow-y-auto bg-canvas" data-testid="app-overview">
      <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex items-start gap-4 sm:gap-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-foreground font-semibold text-background text-2xl">
            {app.name.slice(0, 1)}
          </div>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-balance font-semibold text-2xl tracking-[-0.025em]">{app.name}</h1>
            <p className="mt-1 text-muted-foreground text-sm">/{app.slug}</p>
            <p className="mt-3 max-w-[72ch] text-pretty text-foreground/80 text-sm leading-6">
              {app.description || __('app.overview.noDescription')}
            </p>
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-lg border border-border bg-background">
          <h2 className="border-border border-b px-5 py-4 font-medium text-sm">
            {__('app.overview.information')}
          </h2>
          <dl>
            {details.map(detail => (
              <div
                key={detail.label}
                className="grid gap-1 border-border border-b px-5 py-3.5 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center"
              >
                <dt className="text-muted-foreground text-sm">{detail.label}</dt>
                <dd className="min-w-0 break-words text-sm">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  )
}
