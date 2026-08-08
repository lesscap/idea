import type { RequirementDetail as RequirementDetailValue, RequirementRevision } from '@idea/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { RequirementDetail } from './requirement-detail'

const api = vi.hoisted(() => ({
  getRequirementByCode: vi.fn(),
  getRequirement: vi.fn(),
  getRequirementRevision: vi.fn(),
}))

vi.mock('./api', () => api)

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
      <RequirementDetail
        params={{ code: 'R-1' }}
        appId={7}
        showConversation={showConversation}
      />
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

  it('defaults to the draft and switches between cached revisions in the same resource', async () => {
    api.getRequirementRevision.mockResolvedValue(historical)
    const showConversation = draw()

    expect(await screen.findByRole('heading', { name: '正在修改的标题' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看来源会话' }))
    expect(showConversation).toHaveBeenLastCalledWith('cid-draft')

    await openVersions()
    fireEvent.click(await screen.findByText('v2'))
    expect(await screen.findByRole('heading', { name: '已确认标题' })).toBeInTheDocument()
    expect(api.getRequirementRevision).not.toHaveBeenCalled()

    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    expect(await screen.findByRole('heading', { name: '第一版标题' })).toBeInTheDocument()
    expect(api.getRequirementRevision).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '查看来源会话' }))
    expect(showConversation).toHaveBeenLastCalledWith('cid-history')

    await openVersions()
    fireEvent.click(await screen.findByText('v2'))
    await openVersions()
    fireEvent.click(await screen.findByText('v1'))
    expect(await screen.findByRole('heading', { name: '第一版标题' })).toBeInTheDocument()
    expect(api.getRequirementRevision).toHaveBeenCalledOnce()
  })

  it('defaults to the current revision when no draft exists', async () => {
    api.getRequirement.mockResolvedValue(detail(false))
    draw()

    expect(await screen.findByRole('heading', { name: '已确认标题' })).toBeInTheDocument()
    expect(screen.getByText('当前版本')).toBeInTheDocument()
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
})
