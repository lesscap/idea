import type { App } from '@idea/shared'
import { Boxes, Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listApps } from '../../features/app/api'
import { useLocale } from '../../i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui'

export const AppSwitcher = ({ current, collapsed }: { current: App; collapsed: boolean }) => {
  const __ = useLocale()
  const navigate = useNavigate()
  const [apps, setApps] = useState<App[]>([])

  useEffect(() => {
    listApps()
      .then(page => setApps([...page.items]))
      .catch(() => setApps([]))
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            collapsed ? 'mx-2 w-8 px-2' : 'mx-2 w-[calc(100%_-_1rem)] justify-between px-2'
          }
          data-testid="app-switcher"
          title={collapsed ? current.name : undefined}
        >
          {collapsed ? <Boxes /> : <span className="truncate">{current.name}</span>}
          {!collapsed && <ChevronsUpDown />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {apps.map(app => (
          <DropdownMenuItem
            key={app.slug}
            data-testid={`app-${app.slug}`}
            onSelect={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}
          >
            {app.slug === current.slug ? <Check /> : <span className="w-4" />}
            {app.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="app-all" onSelect={() => navigate('/apps')}>
          <Boxes />
          {__('shell.allApps')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
