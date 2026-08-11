import type { RequirementDetail as RequirementDetailValue, RequirementRevision } from '@idea/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../i18n'
import { RequirementDetail } from './index'

const api = vi.hoisted(() => ({
  getRequirementByCode: vi.fn(),
  getRequirement: vi.fn(),
  getRequirementRevision: vi.fn(),
}))

vi.mock('../api', () => api)

const historical: RequirementRevision = {
  id: 11,
  version: 1,
  code: 'v1',
  title: '第一版标题',
  summary: '第一版摘要',
  body: '第一版正文',
  confirmedAt: '2026-08-01T00:00:00.000Z',
  confirmedInConversationCid: 'cid-history',
}

const detail = (withDraft = true): RequirementDetailValue => ({
  id: 3,
  number: 1,
  code: 'R-1',
  status: 'active',
  draft: withDraft
    ? {
        version: 3,
        title: '正在修改的标题',
        summary: '尚未确认的摘要',
        body: '草稿正文',
        updatedAt: '2026-08-08T00:00:00.000Z',
        updatedInConversationCid: 'cid-draft',
      }
    : null,
  currentRevision: {
    id: 12,
    version: 2,
    code: 'v2',
    title: '已确认标题',
    summary: '已确认摘要',
    body: '当前正文',
    confirmedAt: '2026-08-07T00:00:00.000Z',
    confirmedInConversationCid: 'cid-current',
  },
  revisions: [
    { id: 12, version: 2, code: 'v2', confirmedAt: '2026-08-07T00:00:00.000Z' },
    { id: 11, version: 1, code: 'v1', confirmedAt: '2026-08-01T00:00:00.000Z' },
  ],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
})

const draw = (showConversation = vi.fn()) => {
  render(
    <LocaleProvider initial="zh">
      <RequirementDetail params={{ code: 'R-1' }} appId={7} showConversation={showConversation} />
    </LocaleProvider>,
  )
  return showConversation
}

const openVersions = async () => {
  const trigger = await screen.findByRole('button', { name: '选择需求版本' })
  await act(async () => fireEvent.keyDown(trigger, { key: 'Enter' }))
}

describe('requirement detail', () => {
  beforeEach(() => {
    api.getRequirementByCode.mockReset().mockResolvedValue({ id: 3, code: 'R-1' })
    api.getRequirement.mockReset().mockResolvedValue(detail())
    api.getRequirementRevision.mockReset()
  })

  it('requests a historical revision again after switching away', async () => {
    api.getRequirementRevision.mockResolvedValue(historical)
    const showConversation = draw()

    expect(await screen.findByRole('heading', { name: '正在修改的标题' })).toBeInTheDocument()
    expect(screen.getByTestId('requirement-detail-toolbar')).toHaveTextContent('R-1')
    expect(screen.getByTestId('requirement-detail-toolbar')).toHaveTextContent('已确认')
    expect(screen.getByTestId('requirement-version-menu')).toHaveTextContent('正在查看')
    expect(screen.getByTestId('requirement-version-menu')).toHaveTextContent('未确认')
    expect(screen.getByRole('status')).toHaveTextContent('正在查看草稿，未确认')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-variant', 'document')
    fireEvent.click(screen.getByRole('button', { name: '查看来源会话' }))
    expect(showConversation).toHaveBeenLastCalledWith('cid-draft')

    const detailRegion = screen.getByRole('main')
    detailRegion.scrollTop = 120
    await openVersions()
    fireEvent.click(await screen.findByText('v2'))
    expect(await screen.findByRole('heading', { name: '已确认标题' })).toBeInTheDocument()
    expect(detailRegion.scrollTop).toBe(0)
    expect(screen.getByTestId('requirement-version-menu')).toHaveTextContent('当前版本')
    expect(api.getRequirementRevision).not.toHaveBeenCalled()

    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    expect(screen.getByRole('status')).toHaveTextContent('正在加载 v1…')
    expect(await screen.findByRole('heading', { name: '第一版标题' })).toBeInTheDocument()
    expect(screen.getByTestId('requirement-version-menu')).toHaveTextContent('历史版本')
    expect(screen.getByRole('status')).toHaveTextContent('正在查看v1，历史版本')
    expect(api.getRequirementRevision).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '查看来源会话' }))
    expect(showConversation).toHaveBeenLastCalledWith('cid-history')

    await openVersions()
    fireEvent.click(await screen.findByText('v2'))
    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    expect(await screen.findByRole('heading', { name: '第一版标题' })).toBeInTheDocument()
    expect(api.getRequirementRevision).toHaveBeenCalledTimes(2)
  })

  it('ignores a historical response after another version is selected', async () => {
    let resolveRevision: (value: RequirementRevision) => void = () => undefined
    api.getRequirementRevision.mockReturnValue(
      new Promise<RequirementRevision>(resolve => {
        resolveRevision = resolve
      }),
    )
    draw()
    await screen.findByRole('heading', { name: '正在修改的标题' })

    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    await openVersions()
    fireEvent.click(await screen.findByText('v2'))
    await act(async () => resolveRevision(historical))

    expect(screen.getByRole('heading', { name: '已确认标题' })).toBeInTheDocument()
  })

  it('defaults to the current revision when no draft exists', async () => {
    const currentOnly = detail(false)
    api.getRequirement.mockResolvedValue({
      ...currentOnly,
      revisions: currentOnly.revisions.slice(0, 1),
    })
    draw()

    expect(await screen.findByRole('heading', { name: '已确认标题' })).toBeInTheDocument()
    expect(screen.getByText('当前版本')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择需求版本' })).not.toBeInTheDocument()
  })

  it('keeps the version selector available when a historical revision needs retrying', async () => {
    api.getRequirementRevision
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(historical)
    draw()
    await screen.findByRole('heading', { name: '正在修改的标题' })

    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    fireEvent.click(await screen.findByRole('button', { name: '重试' }))

    await waitFor(() => expect(api.getRequirementRevision).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: '第一版标题' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择需求版本' })).toBeInTheDocument()
  })

  it('keeps requirement identity visible when no version has content', async () => {
    api.getRequirement.mockResolvedValue({
      ...detail(false),
      status: 'draft',
      currentRevision: null,
      revisions: [],
    })
    draw()

    const toolbar = await screen.findByTestId('requirement-detail-toolbar')
    expect(toolbar).toHaveTextContent('R-1')
    expect(toolbar).toHaveTextContent('草稿')
    expect(screen.getByText('这个需求暂时没有可查看的内容。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择需求版本' })).not.toBeInTheDocument()
  })
})
