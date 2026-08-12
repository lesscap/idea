import type { Attachment } from '@idea/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { AppMarkdown } from '.'

const image: Attachment = {
  fid: 'image-1',
  filename: '流程图.png',
  contentType: 'image/png',
  size: 128,
}

const draw = (text: string, onOpenFile = vi.fn()) => {
  render(
    <LocaleProvider initial="zh">
      <AppMarkdown text={text} files={[image]} onOpenFile={onOpenFile} />
    </LocaleProvider>,
  )
  return onOpenFile
}

describe('application markdown images', () => {
  it('renders an associated private image and opens its file resource', () => {
    const openFile = draw('![状态流转](idea-file:image-1)')
    const rendered = screen.getByRole('img', { name: '状态流转' })

    expect(rendered).toHaveAttribute('src', '/api/web/files/image-1')
    fireEvent.click(screen.getByRole('button', { name: '打开图片 流程图.png' }))
    expect(openFile).toHaveBeenCalledWith(image)
  })

  it('does not load external or unassociated images', () => {
    draw('![外部图](https://example.com/a.png)\n\n![未知图](idea-file:missing)')

    expect(document.querySelector('img')).toBeNull()
    expect(screen.getAllByText('图片不可用或未关联到当前内容')).toHaveLength(2)
  })
})
