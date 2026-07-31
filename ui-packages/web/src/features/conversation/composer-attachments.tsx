import type { UploadedFile } from '@idea/shared'
import { File as FileIcon, LoaderCircle, Paperclip, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'

const MAX_ATTACHMENTS = 10

type DraftAttachment =
  | { key: string; file: File; status: 'uploading' }
  | { key: string; file: File; status: 'failed' }
  | { key: string; file: File; status: 'ready'; uploaded: UploadedFile }

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
    const selected = Array.from(files)
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

export const ComposerAttachmentTray = ({ state }: { state: ComposerAttachmentsState }) => {
  const __ = useLocale()

  return (
    <>
      {state.items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5" data-testid="composer-attachments">
          {state.items.map(item => (
            <div
              key={item.key}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 py-1 pr-1 pl-2 text-xs"
            >
              {item.status === 'uploading' ? (
                <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{item.file.name}</span>
              {item.status === 'failed' && (
                <>
                  <span className="text-destructive">{__('shell.uploadFailed')}</span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={__('shell.retryUpload')}
                    onClick={() => state.retry(item.key)}
                  >
                    <RotateCcw className="size-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <p className="px-3 pt-1.5 text-destructive text-xs" role="status">
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
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={__('shell.attachFiles')}
        disabled={state.items.length >= MAX_ATTACHMENTS}
        onClick={() => input.current?.click()}
      >
        <Paperclip className="size-4" />
      </button>
    </>
  )
}
