import type { App } from '@idea/shared'
import { ArrowLeft, Boxes, Check, ChevronDown } from 'lucide-react'
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

export const AppMenu = ({ current }: { current: App }) => {
  const __ = useLocale()
  const navigate = useNavigate()
  const [apps, setApps] = useState<App[]>([])
  useEffect(() => {
    listApps()
      .then(page => setApps([...page.items]))
      .catch(error => {
        console.error('app switcher failed', error)
        setApps([])
      })
  }, [])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 gap-2 px-2" data-testid="app-menu">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-foreground text-background text-xs font-semibold">
            {current.name.slice(0, 1)}
          </span>
          <span className="max-w-48 truncate">{current.name}</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuItem onSelect={() => navigate('/')}>
          <ArrowLeft />
          {__('shell.backToWorkspace')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {apps.map(app => (
          <DropdownMenuItem
            key={app.id}
            onSelect={() => navigate(`/apps/${encodeURIComponent(app.slug)}/dashboard/overview`)}
          >
            {app.id === current.id ? <Check /> : <span className="w-4" />}
            <span className="truncate">{app.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/apps')}>
          <Boxes />
          {__('shell.allApps')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
