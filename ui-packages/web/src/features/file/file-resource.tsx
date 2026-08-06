import type { UploadedFile } from '@idea/shared'
import { Download, FileQuestion, FileText, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { formatBytes } from '../../lib/format-bytes'
import { RequestError } from '../../lib/request'
import { Button, Markdown } from '../../ui'
import { fileDownloadUrl, fileUrl, getFileMeta, getFileText } from './api'
import { HtmlPreview } from './html-preview'
import { ImagePreview } from './image-preview'

type FileKind = 'image' | 'pdf' | 'markdown' | 'html' | 'text' | 'audio' | 'video' | 'unsupported'
type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly error: unknown }

const TEXT_FILENAME =
  /\.(?:txt|log|csv|tsv|json|xml|ya?ml|toml|ini|conf|css|s[ac]ss|less|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|kts|c|h|cc|cpp|hpp|sql|sh|bash|zsh)$/i

const fileKind = (file: Pick<UploadedFile, 'filename' | 'contentType'>): FileKind => {
  const contentType = file.contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  const filename = file.filename.toLowerCase()
  if (contentType === 'text/markdown' || /\.(?:md|markdown)$/.test(filename)) return 'markdown'
  if (contentType === 'text/html' || /\.html?$/.test(filename)) return 'html'
  if (contentType === 'application/pdf' || filename.endsWith('.pdf')) return 'pdf'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('audio/')) return 'audio'
  if (contentType.startsWith('video/') && !filename.endsWith('.ts')) return 'video'
  if (
    contentType.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/javascript'].includes(contentType) ||
    TEXT_FILENAME.test(filename)
  )
    return 'text'
  return 'unsupported'
}

const PreviewSkeleton = () => (
  <div className="flex h-full flex-col gap-3 p-4" aria-busy="true" data-testid="file-loading">
    <div className="h-4 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    <div className="h-3 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    <div className="mt-4 min-h-40 flex-1 animate-pulse rounded-md bg-muted/70 motion-reduce:animate-none" />
  </div>
)

const PreviewError = ({ error, retry }: { error: unknown; retry: () => void }) => {
  const __ = useLocale()
  const tooLarge = error instanceof RequestError && error.code === 'file_preview_too_large'
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm">{tooLarge ? __('file.tooLarge') : __('file.loadFailed')}</p>
      <Button type="button" variant="outline" size="sm" onClick={retry}>
        <RefreshCw />
        {__('common.retry')}
      </Button>
    </div>
  )
}

const TextFilePreview = ({
  file,
  kind,
}: {
  file: UploadedFile
  kind: 'markdown' | 'html' | 'text'
}) => {
  const [state, setState] = useState<LoadState<string>>({ status: 'loading' })

  useEffect(() => {
    if (state.status !== 'loading') return
    let current = true
    getFileText(file.fid).then(
      value => {
        if (current) setState({ status: 'ready', value })
      },
      error => {
        if (current) setState({ status: 'failed', error })
      },
    )
    return () => {
      current = false
    }
  }, [file.fid, state.status])

  if (state.status === 'loading') return <PreviewSkeleton />
  if (state.status === 'failed')
    return <PreviewError error={state.error} retry={() => setState({ status: 'loading' })} />
  if (kind === 'html') return <HtmlPreview source={state.value} filename={file.filename} />
  if (kind === 'markdown')
    return (
      <div className="h-full overflow-auto px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-[75ch]">
          <Markdown text={state.value} />
        </div>
      </div>
    )
  return (
    <pre className="h-full overflow-auto bg-muted/20 p-4 font-mono text-xs leading-relaxed">
      {state.value}
    </pre>
  )
}

const FileBody = ({ file }: { file: UploadedFile }) => {
  const __ = useLocale()
  const kind = fileKind(file)
  const src = fileUrl(file.fid)

  if (kind === 'image') return <ImagePreview src={src} alt={file.filename} />
  if (kind === 'pdf')
    return (
      <iframe
        src={src}
        title={file.filename}
        referrerPolicy="no-referrer"
        className="h-full w-full border-0 bg-muted/20"
        data-testid="pdf-preview"
      />
    )
  if (kind === 'markdown' || kind === 'html' || kind === 'text')
    return <TextFilePreview file={file} kind={kind} />
  if (kind === 'audio')
    return (
      <div className="flex h-full items-center justify-center p-6">
        {/* biome-ignore lint/a11y/useMediaCaption: uploaded media has no separate caption-track resource */}
        <audio src={src} controls className="w-full max-w-xl" data-testid="audio-preview" />
      </div>
    )
  if (kind === 'video')
    return (
      // biome-ignore lint/a11y/useMediaCaption: uploaded media has no separate caption-track resource
      <video
        src={src}
        controls
        className="h-full w-full bg-black object-contain"
        data-testid="video-preview"
      />
    )
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium text-sm">{__('file.unsupported')}</p>
      <p className="max-w-md text-muted-foreground text-xs">{__('file.unsupportedHint')}</p>
    </div>
  )
}

const LoadedFile = ({ file }: { file: UploadedFile }) => {
  const __ = useLocale()
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="file-resource">
      <header className="flex h-11 shrink-0 items-center gap-3 border-border border-b px-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm" title={file.filename}>
            {file.filename}
          </p>
          <p className="truncate text-muted-foreground text-[11px]">
            {file.contentType || __('file.unknownType')} · {formatBytes(file.size)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={fileDownloadUrl(file.fid)} target="_blank" rel="noreferrer">
            <Download />
            {__('file.download')}
          </a>
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <FileBody file={file} />
      </div>
    </div>
  )
}

export const FileResource = ({ params }: { params: Record<string, string | undefined> }) => {
  const [state, setState] = useState<LoadState<UploadedFile>>({ status: 'loading' })
  const fid = params.fid ?? ''

  useEffect(() => {
    if (state.status !== 'loading') return
    let current = true
    getFileMeta(fid).then(
      value => {
        if (current) setState({ status: 'ready', value })
      },
      error => {
        if (current) setState({ status: 'failed', error })
      },
    )
    return () => {
      current = false
    }
  }, [fid, state.status])

  if (state.status === 'loading') return <PreviewSkeleton />
  if (state.status === 'failed')
    return <PreviewError error={state.error} retry={() => setState({ status: 'loading' })} />
  return <LoadedFile file={state.value} />
}
