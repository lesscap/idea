import type { UploadedFile } from '@idea/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { Activity } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import { matchResource } from '../../shell/resources'
import { fileResourceRef } from './api'
import { FileResource } from './file-resource'

const api = vi.hoisted(() => ({
  getFileMeta: vi.fn(),
  getFileText: vi.fn(),
}))

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  getFileMeta: api.getFileMeta,
  getFileText: api.getFileText,
}))

const file = (over: Partial<UploadedFile> = {}): UploadedFile => ({
  fid: 'file123',
  filename: '说明.md',
  contentType: 'text/markdown',
  size: 12,
  status: 'ready',
  url: '/api/web/files/file123',
  createdAt: '2026-08-06T00:00:00.000Z',
  ...over,
})

const draw = () =>
  render(
    <LocaleProvider initial="zh">
      <FileResource params={{ fid: 'file123', '*': '说明.md' }} />
    </LocaleProvider>,
  )

describe('file resource', () => {
  beforeEach(() => {
    api.getFileMeta.mockReset()
    api.getFileText.mockReset()
  })

  it('renders Markdown with the existing application renderer', async () => {
    api.getFileMeta.mockResolvedValue(file())
    api.getFileText.mockResolvedValue('# 标题')
    draw()

    expect(await screen.findByRole('heading', { name: '标题' })).toBeInTheDocument()
  })

  it('keeps HTML in a sandboxed iframe and exposes source as text', async () => {
    const source = '<h1>Preview</h1><script>window.top.location="https://example.com"</script>'
    api.getFileMeta.mockResolvedValue(file({ filename: 'page.html', contentType: 'text/html' }))
    api.getFileText.mockResolvedValue(source)
    draw()

    const frame = await screen.findByTestId('html-preview-frame')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame).toHaveAttribute('srcdoc', source)

    fireEvent.click(screen.getByRole('button', { name: '源码' }))
    expect(screen.getByTestId('html-source')).toHaveTextContent(source)
  })

  it('preserves HTML view state while its workspace tab is hidden', async () => {
    api.getFileMeta.mockResolvedValue(file({ filename: 'page.html', contentType: 'text/html' }))
    api.getFileText.mockResolvedValue('<h1>Preview</h1>')
    const content = (mode: 'visible' | 'hidden') => (
      <LocaleProvider initial="zh">
        <Activity mode={mode}>
          <FileResource params={{ fid: 'file123', '*': 'page.html' }} />
        </Activity>
      </LocaleProvider>
    )
    const view = render(content('visible'))
    await screen.findByTestId('html-preview-frame')
    fireEvent.click(screen.getByRole('button', { name: '源码' }))

    view.rerender(content('hidden'))
    view.rerender(content('visible'))

    expect(await screen.findByTestId('html-source')).toBeInTheDocument()
    expect(api.getFileMeta).toHaveBeenCalledOnce()
    expect(api.getFileText).toHaveBeenCalledOnce()
  })

  it('uses the browser PDF viewer and leaves Office files download-only', async () => {
    api.getFileMeta.mockResolvedValue(
      file({ filename: 'brief.pdf', contentType: 'application/pdf' }),
    )
    const first = draw()
    expect(await screen.findByTestId('pdf-preview')).toHaveAttribute(
      'src',
      '/api/web/files/file123',
    )
    first.unmount()

    api.getFileMeta.mockResolvedValue(
      file({
        filename: 'budget.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    draw()
    expect(await screen.findByText('暂不支持在线预览')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      '/api/web/files/file123/download',
    )
    expect(api.getFileText).not.toHaveBeenCalled()
  })
})

describe('file resource reference', () => {
  it('keeps the file identity and full display name in one tab reference', () => {
    const filename = '报销 #1,最终版.md'
    const matched = matchResource(fileResourceRef({ fid: 'file123', filename }))

    expect(matched).toMatchObject({ kind: 'file', params: { fid: 'file123', '*': filename } })
  })
})
