import type { App } from '@idea/shared'
import { useLocale } from '../../i18n'

export const AppDashboard = ({ app }: { app: App }) => {
  const __ = useLocale()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <h1 className="font-semibold text-lg">{app.name}</h1>
      <p className="text-muted-foreground text-sm">{__('shell.dashboardEmpty')}</p>
    </div>
  )
}
