import type { Attachment } from '@idea/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SentAttachments } from './attachment-view'

const file: Attachment = {
  fid: 'file123',
  filename: '说明.md',
  contentType: 'text/markdown',
  size: 12,
}

describe('sent attachments', () => {
  it('opens the workspace file resource instead of a browser link', () => {
    const onOpen = vi.fn()
    render(<SentAttachments files={[file]} onOpen={onOpen} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /说明.md/ }))

    expect(onOpen).toHaveBeenCalledWith(file)
  })
})
