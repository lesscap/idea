import type { RequirementSummary } from '@idea/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { RequirementList } from './requirement-list'

const api = vi.hoisted(() => ({ listRequirements: vi.fn() }))

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  listRequirements: api.listRequirements,
}))

const requirement = (over: Partial<RequirementSummary> = {}): RequirementSummary => ({
  id: 1,
  number: 1,
  code: 'R-1',
  status: 'active',
  title: '报销申请审批',
  summary: '员工提交报销单后，由直属主管确认。',
  currentRevisionCode: 'v2',
  hasDraft: true,
  updatedAt: '2026-08-08T00:00:00.000Z',
  ...over,
})

const page = (
  items: readonly RequirementSummary[],
  total = items.length,
  pageNumber = 1,
  pageSize = 20,
) => ({ items, total, page: pageNumber, pageSize })

const draw = (openResource = vi.fn()) => {
  render(
    <LocaleProvider initial="zh">
      <RequirementList appId={7} openResource={openResource} />
    </LocaleProvider>,
  )
  return openResource
}

describe('requirement list', () => {
  beforeEach(() => api.listRequirements.mockReset())

  it('shows requirement state and opens its workspace resource', async () => {
    api.listRequirements.mockResolvedValue(page([requirement()]))
    const openResource = draw()

    const row = await screen.findByTestId('requirement-r-1')
    const listPage = screen.getByTestId('requirement-list-page')

    expect(screen.queryByRole('heading', { name: '需求' })).not.toBeInTheDocument()
    expect(listPage).toHaveAttribute('data-state', 'ready')
    expect(listPage).toHaveAttribute('data-total', '1')
    expect(listPage).toHaveAttribute('data-page', '1')
    expect(listPage).toHaveAttribute('data-total-pages', '1')
    expect(screen.getByRole('table', { name: '需求列表' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '编号' })).toBeInTheDocument()
    expect(row).toHaveAttribute('data-status', 'active')
    expect(row).toHaveAttribute('data-has-draft', 'true')

    fireEvent.click(row)

    expect(screen.getByText('已确认')).toBeInTheDocument()
    expect(screen.getByText('有未确认修改')).toBeInTheDocument()
    expect(openResource).toHaveBeenCalledWith('requirements/R-1')
    expect(api.listRequirements).toHaveBeenCalledWith(7, { page: 1, search: '' })
  })

  it('replaces rows when a numbered page is selected', async () => {
    api.listRequirements
      .mockResolvedValueOnce(page([requirement()], 24))
      .mockResolvedValueOnce(
        page([requirement({ id: 24, number: 24, code: 'R-24', title: '审批审计日志' })], 24, 2),
      )
    draw()

    await screen.findByText('报销申请审批')
    fireEvent.click(screen.getByTestId('requirement-pagination-page-2'))

    expect(await screen.findByText('审批审计日志')).toBeInTheDocument()
    expect(screen.queryByText('报销申请审批')).not.toBeInTheDocument()
    expect(screen.getByTestId('requirement-list-page')).toHaveAttribute('data-page', '2')
    expect(api.listRequirements).toHaveBeenNthCalledWith(2, 7, { page: 2, search: '' })
  })

  it('submits and clears a trimmed search from page one', async () => {
    api.listRequirements
      .mockResolvedValueOnce(page([requirement()], 24))
      .mockResolvedValueOnce(
        page([requirement({ id: 2, number: 2, code: 'R-2', title: '审批规则' })]),
      )
      .mockResolvedValueOnce(page([requirement()], 24))
    draw()

    const input = await screen.findByTestId('requirement-search-input')
    fireEvent.change(input, { target: { value: '  审批  ' } })
    fireEvent.click(screen.getByTestId('requirement-search-submit'))

    await waitFor(() =>
      expect(api.listRequirements).toHaveBeenNthCalledWith(2, 7, {
        page: 1,
        search: '审批',
      }),
    )
    expect(await screen.findByText('审批规则')).toBeInTheDocument()
    expect(screen.getByTestId('requirement-list-page')).toHaveAttribute('data-search', '审批')

    fireEvent.click(screen.getByTestId('requirement-search-clear'))
    await waitFor(() =>
      expect(api.listRequirements).toHaveBeenNthCalledWith(3, 7, { page: 1, search: '' }),
    )
    expect(input).toHaveValue('')
  })

  it('retries the current query after a failure', async () => {
    api.listRequirements
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([requirement()]))
    draw()

    expect(await screen.findByTestId('requirement-list-page')).toHaveAttribute(
      'data-state',
      'failed',
    )
    fireEvent.click(screen.getByTestId('requirement-retry'))

    await waitFor(() => expect(api.listRequirements).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('报销申请审批')).toBeInTheDocument()
  })
})
