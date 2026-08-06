import type { App } from '@idea/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharedStoreProvider } from '../../core/store'
import { LocaleProvider } from '../../i18n'
import { RequestError } from '../../lib/request'
import { AppListPage } from './app-list-page'

const api = vi.hoisted(() => ({
  listApps: vi.fn(),
  createApp: vi.fn(),
  updateApp: vi.fn(),
  deleteApp: vi.fn(),
}))

vi.mock('./api', () => api)

const app: App = {
  slug: 'expense-approval',
  name: '报销审批',
  description: '处理员工报销',
  status: 'draft',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const draw = (role: 'admin' | 'member') =>
  render(
    <LocaleProvider initial="zh">
      <SharedStoreProvider initial={{ workspaceId: 1, role }}>
        <MemoryRouter initialEntries={['/apps']}>
          <AppListPage />
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
    api.createApp.mockReset()
    api.updateApp.mockReset()
    api.deleteApp.mockReset()
  })

  it('offers editing to members without exposing permanent deletion', async () => {
    draw('member')

    await openActions()

    expect(screen.getByText('编辑应用')).toBeInTheDocument()
    expect(screen.queryByText('删除应用')).not.toBeInTheDocument()
  })

  it('updates the card and its destination after editing', async () => {
    const updated = {
      ...app,
      slug: 'expense-review',
      name: '费用审批',
      description: '新的简介',
    }
    api.updateApp.mockResolvedValue(updated)
    draw('admin')
    await openActions()
    fireEvent.click(screen.getByText('编辑应用'))

    fireEvent.change(await screen.findByTestId('edit-app-name'), {
      target: { value: updated.name },
    })
    fireEvent.change(screen.getByTestId('edit-app-slug'), { target: { value: updated.slug } })
    fireEvent.change(screen.getByTestId('edit-app-description'), {
      target: { value: updated.description },
    })
    fireEvent.click(screen.getByTestId('edit-app-submit'))

    await waitFor(() =>
      expect(api.updateApp).toHaveBeenCalledWith(app.slug, {
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
      }),
    )
    expect(await screen.findByText(updated.name)).toBeInTheDocument()
    expect(screen.getByTestId('app-card')).toHaveAttribute('data-app-slug', updated.slug)
    expect(screen.getByRole('link', { name: new RegExp(updated.name) })).toHaveAttribute(
      'href',
      '/apps/expense-review',
    )
  })

  it('requires the exact app name before deleting it', async () => {
    api.deleteApp.mockResolvedValue({ removed: app.slug })
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

    await waitFor(() => expect(api.deleteApp).toHaveBeenCalledWith(app.slug))
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
