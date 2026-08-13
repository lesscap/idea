import type { App } from '@idea/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharedStoreProvider } from '../../core/store'
import { LocaleProvider } from '../../i18n'
import { RequestError } from '../../lib/request'
import { AppListPage } from './app-list-page'

const api = vi.hoisted(() => ({
  listApps: vi.fn(),
  updateApp: vi.fn(),
  deleteApp: vi.fn(),
}))

vi.mock('./api', () => api)

const app: App = {
  id: 1,
  slug: 'expense-approval',
  name: '报销审批',
  description: '处理员工报销',
  status: 'draft',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const Location = () => <output data-testid="location">{useLocation().pathname}</output>

const draw = (role: 'admin' | 'member') =>
  render(
    <LocaleProvider initial="zh">
      <SharedStoreProvider initial={{ workspaceId: 1, role }}>
        <MemoryRouter initialEntries={['/apps']}>
          <AppListPage />
          <Location />
        </MemoryRouter>
      </SharedStoreProvider>
    </LocaleProvider>,
  )

const openActions = async () => {
  const trigger = await screen.findByTestId(`app-actions-${app.slug}`)
  await act(async () => fireEvent.keyDown(trigger, { key: 'Enter' }))
}

describe('app management', () => {
  beforeEach(() => {
    api.listApps.mockReset().mockResolvedValue({ items: [app], total: 1, page: 1, pageSize: 20 })
    api.updateApp.mockReset()
    api.deleteApp.mockReset()
  })

  it('starts app creation from the workspace home conversation', async () => {
    draw('admin')

    fireEvent.click(await screen.findByTestId('app-create'))

    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.queryByTestId('app-name')).not.toBeInTheDocument()
  })

  it('does not expose dormant app statuses in the list', async () => {
    api.listApps.mockResolvedValue({
      items: [
        app,
        { ...app, id: 2, slug: 'active-app', name: '使用中的应用', status: 'active' },
        { ...app, id: 3, slug: 'archived-app', name: '归档应用', status: 'archived' },
      ],
      total: 3,
      page: 1,
      pageSize: 20,
    })

    draw('admin')

    await screen.findByText('使用中的应用')
    expect(screen.queryByText('草稿')).not.toBeInTheDocument()
    expect(screen.queryByText('使用中')).not.toBeInTheDocument()
    expect(screen.queryByText('已归档')).not.toBeInTheDocument()
  })

  it('offers renaming to members without exposing permanent deletion', async () => {
    draw('member')

    await openActions()

    expect(screen.getByText('重命名')).toBeInTheDocument()
    expect(screen.queryByText('删除应用')).not.toBeInTheDocument()
  })

  it('renames the app without changing its URL or description', async () => {
    const updated = {
      ...app,
      name: '费用审批',
    }
    api.updateApp.mockResolvedValue(updated)
    draw('admin')
    await openActions()
    fireEvent.click(screen.getByText('重命名'))

    fireEvent.change(await screen.findByTestId('rename-app-name'), {
      target: { value: updated.name },
    })
    fireEvent.click(screen.getByTestId('rename-app-submit'))

    await waitFor(() =>
      expect(api.updateApp).toHaveBeenCalledWith(app.id, {
        name: updated.name,
      }),
    )
    expect(await screen.findByText(updated.name)).toBeInTheDocument()
    expect(screen.getByTestId('app-card')).toHaveAttribute('data-app-slug', app.slug)
    expect(screen.getByRole('link', { name: new RegExp(updated.name) })).toHaveAttribute(
      'href',
      '/apps/expense-approval/dashboard/overview',
    )
  })

  it('requires the exact app name before deleting it', async () => {
    api.deleteApp.mockResolvedValue({ removed: app.id })
    draw('admin')
    await openActions()
    fireEvent.click(screen.getByText('删除应用'))

    const submit = await screen.findByTestId('delete-app-submit')
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('delete-app-confirmation'), {
      target: { value: `${app.name} ` },
    })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('delete-app-confirmation'), {
      target: { value: app.name },
    })
    fireEvent.click(submit)

    await waitFor(() => expect(api.deleteApp).toHaveBeenCalledWith(app.id))
    expect(screen.queryByTestId('app-card')).not.toBeInTheDocument()
  })

  it('keeps the app visible when active Agent work blocks deletion', async () => {
    api.deleteApp.mockRejectedValue(new RequestError('app_busy', 'app is busy'))
    draw('admin')
    await openActions()
    fireEvent.click(screen.getByText('删除应用'))
    fireEvent.change(await screen.findByTestId('delete-app-confirmation'), {
      target: { value: app.name },
    })
    fireEvent.click(screen.getByTestId('delete-app-submit'))

    expect(await screen.findByRole('alert')).toHaveTextContent('应用仍有排队或运行中的 Agent 工作')
    expect(screen.getByTestId('app-card')).toBeInTheDocument()
  })
})
