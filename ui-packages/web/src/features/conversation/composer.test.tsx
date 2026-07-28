import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { Composer } from './composer'

// One rule is worth pinning here: what Enter does. It is the only send path
// most people will use, and the case that breaks it — an IME candidate being
// confirmed — cannot be produced by a real keyboard in a test.

const draw = (onSend = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <LocaleProvider>
      <Composer pending={[]} onSend={onSend} onWithdraw={vi.fn()} />
    </LocaleProvider>,
  )
  const box = screen.getByTestId('composer')
  fireEvent.change(box, { target: { value: '你好' } })
  return { box, onSend }
}

describe('sending with the keyboard', () => {
  it('sends on Enter', () => {
    const { box, onSend } = draw()

    fireEvent.keyDown(box, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('你好')
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

  // What stops the second Enter is the draft being cleared synchronously, not an
  // in-flight flag — the box is still enabled and still accepts typing, which is
  // the point: a second thought may be added while the first is on the wire.
  it('does not submit the same draft twice while the request is pending', () => {
    const onSend = vi.fn(() => new Promise<void>(() => {}))
    const { box } = draw(onSend)

    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.keyDown(box, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledTimes(1)
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
})
