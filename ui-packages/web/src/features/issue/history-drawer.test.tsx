import type { IssueHistoryEntry, IssueRevision } from '@idea/shared'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { HistoryDrawer } from './history-drawer'

const api = vi.hoisted(() => ({ getIssueHistory: vi.fn(), getIssueRevision: vi.fn() }))
vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  getIssueHistory: api.getIssueHistory,
  getIssueRevision: api.getIssueRevision,
}))

const actor = { id: 1, name: 'Demo member' }
const revision = (number: number, body = `Revision ${number} body`): IssueRevision => ({
  kind: 'revision',
  id: number,
  number,
  title: `Revision ${number} title`,
  body,
  images: [],
  attachments: [],
  editedBy: actor,
  createdAt: `2026-08-${number === 1 ? '13' : '14'}T09:2${number}:00.000Z`,
})
const revisionTwo = revision(2)
const history: readonly IssueHistoryEntry[] = [
  {
    kind: 'state_changed',
    id: 4,
    actor,
    fromState: 'closed',
    toState: 'open',
    closeReason: null,
    createdAt: '2026-08-14T10:00:00.000Z',
  },
  revisionTwo,
  revision(1),
]

const draw = (open = true, initial: 'zh' | 'en' = 'en') =>
  render(
    <LocaleProvider initial={initial}>
      <HistoryDrawer appId={5} issueNumber={9} open={open} onOpenChange={vi.fn()} />
    </LocaleProvider>,
  )

beforeEach(() => {
  api.getIssueHistory.mockReset()
  api.getIssueRevision.mockReset()
  api.getIssueHistory.mockResolvedValue(history)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('issue history drawer', () => {
  it('groups the timeline by localized date and exposes revisions as actions', async () => {
    draw()

    expect(await screen.findByRole('button', { name: 'View revision #2' })).toBeVisible()
    expect(screen.getByText('14 Aug 2026')).toBeVisible()
    expect(screen.getByText('13 Aug 2026')).toBeVisible()
    expect(screen.getByText('Demo member reopened the issue')).toBeVisible()
  })

  it('shows an empty state and recovers after the history request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.getIssueHistory.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    draw()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load issue history. Try again.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('No history yet')).toBeVisible()
    expect(api.getIssueHistory).toHaveBeenCalledTimes(2)
  })

  it('loads a vertical revision comparison and returns to the timeline', async () => {
    api.getIssueRevision.mockImplementation(
      (_appId: number, _issueNumber: number, number: number) => Promise.resolve(revision(number)),
    )
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'View revision #2' }))

    const before = await screen.findByRole('region', { name: 'Before' })
    const after = screen.getByRole('region', { name: 'After' })
    expect(within(before).getByText('Revision 1 body')).toBeVisible()
    expect(within(after).getByText('Revision 2 body')).toBeVisible()
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(api.getIssueRevision).toHaveBeenCalledWith(5, 9, 2)
    expect(api.getIssueRevision).toHaveBeenCalledWith(5, 9, 1)

    fireEvent.click(screen.getByRole('button', { name: 'Back to history' }))
    expect(await screen.findByRole('button', { name: 'View revision #2' })).toBeVisible()
  })

  it('resets the comparison and reloads history when reopened', async () => {
    api.getIssueRevision.mockImplementation(
      (_appId: number, _issueNumber: number, number: number) => Promise.resolve(revision(number)),
    )
    const view = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'View revision #2' }))
    expect(await screen.findByRole('region', { name: 'After' })).toBeVisible()

    view.rerender(
      <LocaleProvider initial="en">
        <HistoryDrawer appId={5} issueNumber={9} open={false} onOpenChange={vi.fn()} />
      </LocaleProvider>,
    )
    view.rerender(
      <LocaleProvider initial="en">
        <HistoryDrawer appId={5} issueNumber={9} open onOpenChange={vi.fn()} />
      </LocaleProvider>,
    )

    expect(await screen.findByRole('button', { name: 'View revision #2' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'After' })).not.toBeInTheDocument()
    await waitFor(() => expect(api.getIssueHistory).toHaveBeenCalledTimes(2))
  })

  it('returns focus to the button that opened the drawer', async () => {
    const Harness = () => {
      const [open, setOpen] = useState(false)
      return (
        <LocaleProvider initial="en">
          <button type="button" onClick={() => setOpen(true)}>
            Show history
          </button>
          <HistoryDrawer appId={5} issueNumber={9} open={open} onOpenChange={setOpen} />
        </LocaleProvider>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Show history' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
