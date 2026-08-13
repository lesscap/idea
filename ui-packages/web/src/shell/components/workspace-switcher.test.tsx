import type { WorkspaceMembership } from '@idea/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentWorkspaceId } from '../../core/session/use-session'
import { SharedStoreProvider } from '../../core/store'
import { LocaleProvider } from '../../i18n'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui'
import { WorkspaceSwitcher } from './workspace-switcher'

const api = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  selectWorkspace: vi.fn(),
}))

vi.mock('../../features/workspace/api', () => ({ listWorkspaces: api.listWorkspaces }))
vi.mock('../../core/session/api', () => ({ selectWorkspace: api.selectWorkspace }))

const workspaces: WorkspaceMembership[] = [
  { id: 1, name: '主空间', role: 'admin', createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 2, name: '协作空间', role: 'member', createdAt: '2026-08-02T00:00:00.000Z' },
]

const State = () => {
  const location = useLocation()
  const workspaceId = useCurrentWorkspaceId()
  return <output data-testid="state">{`${workspaceId}:${location.pathname}`}</output>
}

const draw = () =>
  render(
    <LocaleProvider initial="zh">
      <SharedStoreProvider initial={{ workspaceId: 1, role: 'admin' }}>
        <MemoryRouter initialEntries={['/apps']}>
          <DropdownMenu open>
            <DropdownMenuTrigger>账户</DropdownMenuTrigger>
            <DropdownMenuContent>
              <WorkspaceSwitcher />
            </DropdownMenuContent>
          </DropdownMenu>
          <State />
        </MemoryRouter>
      </SharedStoreProvider>
    </LocaleProvider>,
  )

const openWorkspaceMenu = async () => {
  const trigger = await screen.findByTestId('workspace-switcher')
  fireEvent.pointerMove(trigger, { pointerType: 'mouse' })
}

describe('workspace switcher', () => {
  beforeEach(() => {
    api.listWorkspaces.mockReset().mockResolvedValue(workspaces)
    api.selectWorkspace.mockReset().mockResolvedValue({ workspaceId: 2, role: 'member' })
  })

  it('keeps workspace management available when there is only one workspace', async () => {
    api.listWorkspaces.mockResolvedValue([workspaces[0]])
    draw()

    expect(await screen.findByText('空间管理')).toBeInTheDocument()
    await openWorkspaceMenu()

    expect(await screen.findByTestId('workspace-1')).toHaveAttribute('aria-current', 'true')
  })

  it('lists all workspaces and switches back to the workspace home', async () => {
    draw()
    await openWorkspaceMenu()

    expect(await screen.findByTestId('workspace-1')).toHaveAttribute('aria-current', 'true')
    fireEvent.click(screen.getByTestId('workspace-2'))

    await waitFor(() => expect(api.selectWorkspace).toHaveBeenCalledWith(2))
    expect(await screen.findByTestId('state')).toHaveTextContent('2:/')
  })

  it('does not reselect the current workspace', async () => {
    draw()
    await openWorkspaceMenu()

    fireEvent.click(await screen.findByTestId('workspace-1'))

    expect(api.selectWorkspace).not.toHaveBeenCalled()
    expect(screen.getByTestId('state')).toHaveTextContent('1:/apps')
  })

  it('reports a failed workspace list without changing the session', async () => {
    const error = new Error('offline')
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.listWorkspaces.mockRejectedValue(error)
    draw()

    await waitFor(() => expect(report).toHaveBeenCalledWith('workspace list failed', error))
    expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('state')).toHaveTextContent('1:/apps')
    report.mockRestore()
  })
})
