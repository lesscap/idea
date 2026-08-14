import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { IssueEditor } from './issue-editor'

const upload = vi.hoisted(() => vi.fn())
vi.mock('../file/upload', () => ({ uploadConversationFile: upload }))

describe('issue editor uploads', () => {
  beforeEach(() => upload.mockReset())

  it('keeps successful files when another upload fails', async () => {
    upload
      .mockResolvedValueOnce({
        fid: 'kept',
        filename: 'kept.txt',
        contentType: 'text/plain',
        size: 4,
      })
      .mockRejectedValueOnce(new Error('upload failed'))
    const view = render(
      <LocaleProvider initial="en">
        <IssueEditor
          appId={2}
          labels={[]}
          submitLabel="Create issue"
          onSubmit={vi.fn()}
        />
      </LocaleProvider>,
    )
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    expect(input).not.toBeVisible()
    expect(screen.queryByRole('button', { name: /choose files/i })).not.toBeInTheDocument()

    fireEvent.change(input!, {
      target: {
        files: [
          new File(['kept'], 'kept.txt', { type: 'text/plain' }),
          new File(['failed'], 'failed.txt', { type: 'text/plain' }),
        ],
      },
    })

    expect(await screen.findByText('kept.txt')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('1 files failed to upload')
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
  })
})
