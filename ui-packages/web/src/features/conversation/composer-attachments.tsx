import type { UploadedFile } from '@idea/shared'
import { LoaderCircle, Paperclip, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { AttachmentVisual } from './attachment-view'

const MAX_ATTACHMENTS = 10

type DraftAttachment =
  | { key: string; file: File; status: 'uploading' }
  | { key: string; file: File; status: 'failed' }
  | { key: string; file: File; status: 'ready'; uploaded: UploadedFile }

const withName = (file: File, index: number): File => {
  if (file.name) return file
  const extension = file.type.split('/')[1] || 'bin'
  return new File([file], `paste-${Date.now()}-${index}.${extension}`, { type: file.type })
}

export const useComposerAttachments = (upload: (file: File) => Promise<UploadedFile>) => {
  const [items, setItems] = useState<DraftAttachment[]>([])
  const [limitReached, setLimitReached] = useState(false)

  const begin = (item: DraftAttachment) => {
    void upload(item.file)
      .then(uploaded => {
        setItems(current =>
          current.map(existing =>
            existing.key === item.key ? { ...existing, status: 'ready', uploaded } : existing,
          ),
        )
      })
      .catch(() => {
        setItems(current =>
          current.map(existing =>
            existing.key === item.key ? { ...existing, status: 'failed' } : existing,
          ),
        )
      })
  }

  const add = (files: FileList | readonly File[]) => {
    const available = Math.max(0, MAX_ATTACHMENTS - items.length)
    const selected = Array.from(files).map(withName)
    const added = selected.slice(0, available).map(file => ({
      key: crypto.randomUUID(),
      file,
      status: 'uploading' as const,
    }))
    setLimitReached(selected.length > available)
    if (added.length === 0) return
    setItems(current => [...current, ...added])
    added.forEach(begin)
  }

  const retry = (key: string) => {
    const item = items.find(candidate => candidate.key === key)
    if (item?.status !== 'failed') return
    const uploading = { ...item, status: 'uploading' as const }
    setItems(current => current.map(candidate => (candidate.key === key ? uploading : candidate)))
    begin(uploading)
  }

  return {
    items,
    limitReached,
    add,
    retry,
    remove: (key: string) => setItems(current => current.filter(item => item.key !== key)),
    removeUploaded: (fids: readonly string[]) => {
      const sent = new Set(fids)
      setItems(current =>
        current.filter(item => item.status !== 'ready' || !sent.has(item.uploaded.fid)),
      )
      setLimitReached(false)
    },
    ready: items.flatMap(item => (item.status === 'ready' ? [item.uploaded] : [])),
    unsettled: items.some(item => item.status !== 'ready'),
  }
}

export type ComposerAttachmentsState = ReturnType<typeof useComposerAttachments>

export const ComposerAttachmentTray = ({
  state,
  onOpen,
}: {
  state: ComposerAttachmentsState
  onOpen: (file: UploadedFile) => void
}) => {
  const __ = useLocale()

  return (
    <>
      {state.items.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3" data-testid="composer-attachments">
          {state.items.map(item => (
            <div key={item.key} className="relative min-w-0 max-w-full">
              {item.status === 'ready' ? (
                <button
                  type="button"
                  className="rounded-md text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(item.uploaded)}
                >
                  <AttachmentVisual file={item.uploaded} />
                </button>
              ) : (
                <span className="flex min-h-14 min-w-44 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
                  {item.status === 'uploading' ? (
                    <LoaderCircle
                      className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Paperclip className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.file.name}</span>
                    <span className="block text-muted-foreground">
                      {item.status === 'uploading'
                        ? __('shell.uploading')
                        : __('shell.uploadFailed')}
                    </span>
                  </span>
                  {item.status === 'failed' && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={__('shell.retryUpload')}
                      onClick={() => state.retry(item.key)}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                </span>
              )}
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={__('shell.removeAttachment')}
                onClick={() => state.remove(item.key)}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {state.limitReached && (
        <p className="px-3 pt-2 text-destructive text-xs" role="status">
          {__('shell.attachmentLimit', MAX_ATTACHMENTS)}
        </p>
      )}
    </>
  )
}

export const ComposerAttachmentButton = ({ state }: { state: ComposerAttachmentsState }) => {
  const __ = useLocale()
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={input}
        className="hidden"
        type="file"
        multiple
        data-testid="composer-file-input"
        onChange={event => {
          if (event.target.files) state.add(event.target.files)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        aria-label={__('shell.attachFiles')}
        disabled={state.items.length >= MAX_ATTACHMENTS}
        onClick={() => input.current?.click()}
      >
        <Paperclip className="size-4" />
      </button>
    </>
  )
}
