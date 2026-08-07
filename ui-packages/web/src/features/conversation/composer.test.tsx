import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { Composer } from './composer'
import type { PendingInput } from './use-conversation'

// One rule is worth pinning here: what Enter does. It is the only send path
// most people will use, and the case that breaks it — an IME candidate being
// confirmed — cannot be produced by a real keyboard in a test.

const draw = ({
  onSend = vi.fn().mockResolvedValue(undefined),
  onUpload = vi.fn().mockResolvedValue({
    fid: 'file123',
    filename: 'brief.pdf',
    contentType: 'application/pdf',
    size: 5,
    status: 'ready',
    url: '/api/web/files/file123',
    createdAt: '2026-08-05T00:00:00.000Z',
  }),
  onOpenFile = vi.fn(),
  onWithdraw = vi.fn().mockResolvedValue(undefined),
  pending = [],
  exclusiveSubmit = false,
  disabled = false,
}: {
  onSend?: ReturnType<typeof vi.fn>
  onUpload?: ReturnType<typeof vi.fn>
  onOpenFile?: ReturnType<typeof vi.fn>
  onWithdraw?: ReturnType<typeof vi.fn>
  pending?: readonly PendingInput[]
  exclusiveSubmit?: boolean
  disabled?: boolean
} = {}) => {
  render(
    <LocaleProvider>
      <Composer
        pending={pending}
        onSend={onSend}
        onUpload={onUpload}
        onOpenFile={onOpenFile}
        onWithdraw={onWithdraw}
        exclusiveSubmit={exclusiveSubmit}
        disabled={disabled}
      />
    </LocaleProvider>,
  )
  const box = screen.getByTestId('composer')
  fireEvent.change(box, { target: { value: '你好' } })
  return { box, onSend, onUpload, onOpenFile }
}

describe('sending with the keyboard', () => {
  it('sends on Enter', async () => {
    const { box, onSend } = draw()

    await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))

    expect(onSend).toHaveBeenCalledWith('你好', [])
  })

  // Enter also confirms a candidate in a Chinese IME. Sending there ships half a
  // pinyin string, and this interface is Chinese first — the common path, not an
  // edge case.
  it('does not send while an IME candidate is open', () => {
    const { box, onSend } = draw()

    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('leaves Shift+Enter to insert a newline', () => {
    const { box, onSend } = draw()

    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('locks a new conversation until creation finishes and restores a failed message', async () => {
    let rejectRequest: (error: Error) => void = () => undefined
    const request = new Promise<void>((_, reject) => {
      rejectRequest = reject
    })
    const onSend = vi.fn(() => request)
    const { box } = draw({ onSend, exclusiveSubmit: true })

    fireEvent.keyDown(box, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(box).toBeDisabled()

    await act(async () => {
      rejectRequest(new Error('failed'))
      await request.catch(() => undefined)
    })

    expect(box).not.toBeDisabled()
    expect(box).toHaveValue('你好')
    expect(screen.getByRole('alert')).toHaveTextContent('发送失败，消息已恢复，请重试。')

    fireEvent.change(box, { target: { value: '修改后重试' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a newer draft when an earlier send fails', async () => {
    let rejectRequest: (error: Error) => void = () => undefined
    const request = new Promise<void>((_, reject) => {
      rejectRequest = reject
    })
    const { box } = draw({ onSend: vi.fn(() => request) })

    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: '第二条' } })

    await act(async () => {
      rejectRequest(new Error('failed'))
      await request.catch(() => undefined)
    })

    expect(box).toHaveValue('你好\n\n第二条')
  })
})

describe('the arrow', () => {
  // The one saturated element in the panel should never be idle: disabled is
  // what keeps it grey until there is something to send.
  it('is disabled until the draft has something in it', () => {
    const { box } = draw()
    expect(screen.getByTestId('composer-send')).not.toBeDisabled()

    fireEvent.change(box, { target: { value: '   ' } })

    expect(screen.getByTestId('composer-send')).toBeDisabled()
  })

  it('disables message and file input when no worker is assigned', () => {
    const { box } = draw({ disabled: true })

    expect(box).toBeDisabled()
    expect(screen.getByTestId('composer-file-input')).toBeDisabled()
    expect(screen.getByTestId('composer-send')).toBeDisabled()
  })
})

describe('attachments', () => {
  it('uploads immediately and sends a ready file without text', async () => {
    const { box, onSend, onUpload } = draw()
    fireEvent.change(box, { target: { value: '' } })
    const file = new File(['brief'], 'brief.pdf', { type: 'application/pdf' })

    fireEvent.change(screen.getByTestId('composer-file-input'), {
      target: { files: [file] },
    })

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file))
    await waitFor(() => expect(screen.getByText('brief.pdf')).toBeInTheDocument())
    await act(async () => fireEvent.click(screen.getByTestId('composer-send')))

    expect(onSend).toHaveBeenCalledWith('', ['file123'])
  })

  it('opens a ready attachment without sending it', async () => {
    const { box, onOpenFile, onSend } = draw()
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.change(screen.getByTestId('composer-file-input'), {
      target: { files: [new File(['brief'], 'brief.pdf', { type: 'application/pdf' })] },
    })

    fireEvent.click(await screen.findByRole('button', { name: /brief.pdf/ }))

    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ fid: 'file123' }))
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('withdrawing queued input', () => {
  it('blocks duplicate withdrawal and leaves a failed item available to retry', async () => {
    let rejectRequest: (error: Error) => void = () => undefined
    const request = new Promise<void>((_, reject) => {
      rejectRequest = reject
    })
    const onWithdraw = vi.fn(() => request)
    draw({
      onWithdraw,
      pending: [
        { id: 7, text: '补充说明', attachments: [], createdAt: '2026-07-29T00:01:00.000Z' },
      ],
    })
    const button = screen.getByTestId('pending-withdraw-7')

    fireEvent.click(button)
    fireEvent.click(button)

    expect(onWithdraw).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()

    await act(async () => {
      rejectRequest(new Error('failed'))
      await request.catch(() => undefined)
    })

    expect(button).not.toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('撤回失败，请重试')
  })
})
