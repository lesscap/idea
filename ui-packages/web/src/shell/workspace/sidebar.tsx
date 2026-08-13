import { Boxes, Home, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useWorkspaceSidebar } from '../../core/layout/use-layout'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'
import { AccountMenu } from '../components/account-menu'
import { BrandMark } from '../components/brand-mark'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors ${
    isActive ? 'bg-nav-active font-medium text-foreground' : 'text-foreground/75 hover:bg-nav-hover'
  }`

export const WorkspaceSidebar = () => {
  const __ = useLocale()
  const [collapsed, setCollapsed] = useWorkspaceSidebar()

  return (
    <aside
      className={`hidden shrink-0 flex-col border-border border-r bg-shell transition-[width] duration-200 md:flex ${
        collapsed ? 'w-[52px]' : 'w-60'
      }`}
      data-testid="workspace-sidebar"
    >
      <div className="flex h-[52px] items-center justify-between px-3">
        <BrandMark compact={collapsed} />
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            aria-label={__('shell.collapseSide')}
          >
            <PanelLeftClose />
          </Button>
        )}
      </div>
      {collapsed && (
        <Button
          className="mx-2 mb-2"
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          aria-label={__('shell.expandSide')}
        >
          <PanelLeftOpen />
        </Button>
      )}
      <nav className="flex flex-col gap-1 px-2">
        <NavLink to="/" end className={itemClass}>
          <Home className="size-4 shrink-0" />
          {!collapsed && __('resource.home')}
        </NavLink>
        <NavLink to="/apps" className={itemClass}>
          <Boxes className="size-4 shrink-0" />
          {!collapsed && __('shell.allApps')}
        </NavLink>
      </nav>
      <div className="mt-auto border-border border-t p-2">
        <AccountMenu compact={collapsed} placement="sidebar" />
      </div>
    </aside>
  )
}
