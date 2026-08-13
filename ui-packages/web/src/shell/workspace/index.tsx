import { Boxes, Home } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { AccountMenu } from '../components/account-menu'
import { BrandMark } from '../components/brand-mark'
import { WorkspaceSidebar } from './sidebar'

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `grid size-9 place-items-center rounded-md ${isActive ? 'bg-nav-active' : 'hover:bg-nav-hover'}`

const MobileHeader = () => {
  const __ = useLocale()
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1 border-border border-b bg-shell px-3 md:hidden">
      <BrandMark compact />
      <nav className="ml-auto flex items-center gap-1">
        <NavLink to="/" end className={mobileLink} aria-label={__('resource.home')}>
          <Home className="size-4" />
        </NavLink>
        <NavLink to="/apps" className={mobileLink} aria-label={__('resource.apps')}>
          <Boxes className="size-4" />
        </NavLink>
      </nav>
      <AccountMenu compact placement="header" />
    </header>
  )
}

export const WorkspaceShell = () => (
  <div
    className="flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row"
    data-testid="workspace-shell"
  >
    <MobileHeader />
    <WorkspaceSidebar />
    <Outlet />
  </div>
)
