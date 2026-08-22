import type { IssueSummary, Paged } from '@idea/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { IssueList } from './issue-list'

const api = vi.hoisted(() => ({ listIssues: vi.fn(), listLabels: vi.fn() }))
vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  listIssues: api.listIssues,
  listLabels: api.listLabels,
}))

const issue: IssueSummary = {
  id: 9,
  number: 7,
  title: '审批超时提醒',
  state: 'open',
  closeReason: null,
  type: 'task',
  labels: [{ id: 3, name: 'priority-high', description: null, color: 'b60205' }],
  createdBy: { id: 1, name: '演示成员' },
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
}

const page = (items: readonly IssueSummary[]): Paged<IssueSummary> => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
})

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('issue list', () => {
  beforeEach(() => {
    api.listIssues.mockReset()
    api.listLabels.mockReset()
    api.listLabels.mockResolvedValue(issue.labels)
    api.listIssues.mockResolvedValue(page([issue]))
  })

  it('opens an issue by app-local number', async () => {
    const openResource = vi.fn()
    render(
      <LocaleProvider initial="zh">
        <IssueList appId={5} openResource={openResource} />
      </LocaleProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /审批超时提醒/ }))

    expect(openResource).toHaveBeenCalledWith('issues/7')
    expect(api.listIssues).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ state: 'open', type: null, labelIds: [] }),
    )
  })

  it('reloads the same resource with the closed-state filter', async () => {
    render(
      <LocaleProvider initial="zh">
        <IssueList appId={5} openResource={vi.fn()} />
      </LocaleProvider>,
    )
    await screen.findByText('审批超时提醒')
    fireEvent.click(screen.getByRole('button', { name: '已关闭' }))

    await waitFor(() =>
      expect(api.listIssues).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ state: 'closed' }),
      ),
    )
  })

  it('filters by type and can return to all types', async () => {
    render(
      <LocaleProvider initial="en">
        <IssueList appId={5} openResource={vi.fn()} />
      </LocaleProvider>,
    )
    await screen.findByText('审批超时提醒')

    const trigger = screen.getByRole('combobox', { name: 'Filter by type' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Bug' }))
    await waitFor(() =>
      expect(api.listIssues).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ page: 1, type: 'bug' }),
      ),
    )

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'All types' }))
    await waitFor(() =>
      expect(api.listIssues).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ page: 1, type: null }),
      ),
    )
  })
})
