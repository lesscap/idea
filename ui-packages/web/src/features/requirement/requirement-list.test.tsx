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
) => ({
  items,
  total,
  page: pageNumber,
  pageSize,
})

const draw = (openResource = vi.fn()) => {
  render(
    <LocaleProvider initial="zh">
      <RequirementList
        appId={7}
        openResource={openResource}
      />
    </LocaleProvider>,
  )
  return openResource
}

describe('requirement list', () => {
  beforeEach(() => api.listRequirements.mockReset())

  it('shows requirement state and opens its workspace resource', async () => {
    api.listRequirements.mockResolvedValue(page([requirement()]))
    const openResource = draw()

    fireEvent.click(await screen.findByRole('button', { name: /报销申请审批/ }))

    expect(screen.getByText('已确认')).toBeInTheDocument()
    expect(screen.getByText('有未确认修改')).toBeInTheDocument()
    expect(openResource).toHaveBeenCalledWith('requirements/R-1')
  })

  it('appends another page without duplicating requirements', async () => {
    api.listRequirements
      .mockResolvedValueOnce(page([requirement()], 2, 1, 1))
      .mockResolvedValueOnce(
        page(
          [requirement(), requirement({ id: 2, number: 2, code: 'R-2', title: '差旅预订' })],
          2,
          1,
          2,
        ),
      )
    draw()

    fireEvent.click(await screen.findByRole('button', { name: '加载更多' }))

    expect(await screen.findByText('差旅预订')).toBeInTheDocument()
    expect(screen.getAllByText('报销申请审批')).toHaveLength(1)
    expect(api.listRequirements).toHaveBeenNthCalledWith(2, 7, 2)
  })

  it('retries the initial request after a failure', async () => {
    api.listRequirements
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([requirement()]))
    draw()

    fireEvent.click(await screen.findByRole('button', { name: '重试' }))

    await waitFor(() => expect(api.listRequirements).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('报销申请审批')).toBeInTheDocument()
  })
})
