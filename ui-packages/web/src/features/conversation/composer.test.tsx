import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { Composer } from './composer'
import type { ModelConfiguration, PendingInput } from './use-conversation'

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
  onStop = vi.fn().mockResolvedValue(undefined),
  onConfigureModel = vi.fn().mockResolvedValue(undefined),
  pending = [],
  running = false,
  stopping = false,
  stopFailed = false,
  exclusiveSubmit = false,
  disabled = false,
  modelConfiguration = {
    kind: 'claude',
    defaultModel: 'glm-5.2',
    models: ['glm-5.2'],
    efforts: { 'glm-5.2': [] },
    model: null,
    effort: null,
  },
}: {
  onSend?: ReturnType<typeof vi.fn>
  onUpload?: ReturnType<typeof vi.fn>
  onOpenFile?: ReturnType<typeof vi.fn>
  onWithdraw?: ReturnType<typeof vi.fn>
  onStop?: ReturnType<typeof vi.fn>
  onConfigureModel?: ReturnType<typeof vi.fn>
  pending?: readonly PendingInput[]
  running?: boolean
  stopping?: boolean
  stopFailed?: boolean
  exclusiveSubmit?: boolean
  disabled?: boolean
  modelConfiguration?: ModelConfiguration
} = {}) => {
  render(
    <LocaleProvider>
      <Composer
        pending={pending}
        onSend={onSend}
        onUpload={onUpload}
        onOpenFile={onOpenFile}
        onWithdraw={onWithdraw}
        running={running}
        stopping={stopping}
        stopFailed={stopFailed}
        onStop={onStop}
        exclusiveSubmit={exclusiveSubmit}
        disabled={disabled}
        modelConfiguration={modelConfiguration}
        onConfigureModel={onConfigureModel}
      />
    </LocaleProvider>,
  )
  const box = screen.getByTestId('composer')
  fireEvent.change(box, { target: { value: '你好' } })
  return { box, onSend, onUpload, onOpenFile, onConfigureModel, onStop }
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

describe('model command', () => {
  it('applies model and effort without sending a message', async () => {
    const { box, onSend, onConfigureModel } = draw()
    fireEvent.change(box, { target: { value: '/model future-model high' } })

    await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))

    expect(onConfigureModel).toHaveBeenCalledWith('future-model', 'high')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('hides effort when the current provider model has no configured levels', () => {
    draw()

    fireEvent.pointerDown(screen.getByTestId('model-control'), { button: 0, ctrlKey: false })

    expect(screen.getByText('恢复 Provider 默认值')).toBeInTheDocument()
    expect(screen.queryByText('推理强度')).not.toBeInTheDocument()
  })

  it('shows only the effort levels configured for the current model', async () => {
    draw({
      modelConfiguration: {
        kind: 'codex',
        defaultModel: 'gpt-5.6-sol',
        models: ['gpt-5.6-sol'],
        efforts: { 'gpt-5.6-sol': ['minimal', 'high'] },
        model: null,
        effort: null,
      },
    })

    fireEvent.pointerDown(screen.getByTestId('model-control'), { button: 0, ctrlKey: false })
    fireEvent.pointerMove(screen.getByText('推理强度'), { pointerType: 'mouse' })

    expect(await screen.findByText('minimal')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.queryByText('max')).not.toBeInTheDocument()
  })

  it('clears an effort that the newly selected model does not support', async () => {
    const onConfigureModel = vi.fn().mockResolvedValue(undefined)
    draw({
      onConfigureModel,
      modelConfiguration: {
        kind: 'codex',
        defaultModel: 'gpt-5.6-sol',
        models: ['gpt-5.6-sol', 'gpt-5.6-terra'],
        efforts: {
          'gpt-5.6-sol': ['high'],
          'gpt-5.6-terra': ['low'],
        },
        model: null,
        effort: 'high',
      },
    })

    fireEvent.pointerDown(screen.getByTestId('model-control'), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByText('gpt-5.6-terra'))

    await waitFor(() => expect(onConfigureModel).toHaveBeenCalledWith('gpt-5.6-terra', null))
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

describe('stopping a running turn', () => {
  it('replaces the send action while Enter still queues another message', async () => {
    const { box, onSend, onStop } = draw({ running: true })

    fireEvent.click(screen.getByTestId('composer-stop'))
    await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))

    expect(onStop).toHaveBeenCalledOnce()
    expect(onSend).toHaveBeenCalledWith('你好', [])
    expect(screen.getByTestId('composer-send')).not.toBeVisible()
  })

  it('prevents duplicate stops and reports a failed request', () => {
    draw({ running: true, stopping: true, stopFailed: true })

    expect(screen.getByTestId('composer-stop')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('停止失败，请重试。')
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
