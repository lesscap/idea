import type { IssueDetail as IssueDetailValue, IssueLabel } from '@idea/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { RequestError } from '../../lib/request'
import { IssueDetail } from './issue-detail'

const api = vi.hoisted(() => ({
  getIssue: vi.fn(),
  listLabels: vi.fn(),
  updateIssue: vi.fn(),
  setIssueType: vi.fn(),
  setIssueLabels: vi.fn(),
}))

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  getIssue: api.getIssue,
  listLabels: api.listLabels,
  updateIssue: api.updateIssue,
  setIssueType: api.setIssueType,
  setIssueLabels: api.setIssueLabels,
}))

const label: IssueLabel = {
  id: 4,
  name: 'workflow',
  description: null,
  color: '8250df',
}

const issue: IssueDetailValue = {
  id: 9,
  number: 9,
  title: 'Browser acceptance',
  body: 'Original body',
  state: 'open',
  closeReason: null,
  type: 'feature',
  labels: [label],
  revisionNumber: 2,
  images: [],
  attachments: [],
  createdBy: { id: 1, name: 'Demo' },
  updatedBy: { id: 1, name: 'Demo' },
  closedBy: null,
  closedAt: null,
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T01:00:00.000Z',
}

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

describe('issue detail editing', () => {
  beforeEach(() => {
    Object.values(api).forEach(mock => {
      mock.mockReset()
    })
    api.getIssue.mockResolvedValue(issue)
    api.listLabels.mockResolvedValue([label])
    api.updateIssue.mockResolvedValue({ ...issue, title: 'Updated title' })
  })

  const draw = () =>
    render(
      <LocaleProvider initial="en">
        <IssueDetail
          params={{ number: '9' }}
          appId={2}
          openResource={vi.fn()}
          openFile={vi.fn()}
        />
      </LocaleProvider>,
    )

  it('uses one metadata editor and one atomic save request', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('heading', { name: 'Edit issue #9' })).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: 'Type' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Choose labels' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Updated title' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.updateIssue).toHaveBeenCalledWith(2, 9, {
        title: 'Updated title',
        body: 'Original body',
        type: 'feature',
        labelIds: [4],
        imageFids: [],
        attachmentFids: [],
        expectedUpdatedAt: issue.updatedAt,
      }),
    )
    expect(api.updateIssue).toHaveBeenCalledOnce()
  })

  it('keeps the draft after a save conflict', async () => {
    api.updateIssue.mockRejectedValue(
      new RequestError('issue_update_conflict', 'issue has changed'),
    )
    api.getIssue.mockResolvedValueOnce(issue).mockResolvedValueOnce({
      ...issue,
      updatedAt: '2026-08-14T02:00:00.000Z',
    })
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const title = screen.getByRole('textbox', { name: 'Title' })
    fireEvent.change(title, { target: { value: 'Preserved draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft was kept')
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Preserved draft')
    expect(api.getIssue).toHaveBeenCalledTimes(2)
  })
})
