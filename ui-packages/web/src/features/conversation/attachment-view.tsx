import type { Attachment, UploadedFile } from '@idea/shared'
import { FileText } from 'lucide-react'
import { formatBytes } from '../../lib/format-bytes'

type AttachmentLike = Attachment | UploadedFile

export const attachmentUrl = (file: AttachmentLike): string =>
  'url' in file && file.url ? file.url : `/api/web/files/${encodeURIComponent(file.fid)}`

export const isImageAttachment = (file: AttachmentLike): boolean =>
  file.contentType.startsWith('image/')

export const AttachmentVisual = ({ file }: { file: AttachmentLike }) =>
  isImageAttachment(file) ? (
    <img
      src={attachmentUrl(file)}
      alt={file.filename}
      className="size-14 rounded-md border border-border object-cover"
    />
  ) : (
    <span className="flex min-w-0 max-w-56 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs">{file.filename}</span>
        <span className="block text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
    </span>
  )

export const SentAttachments = ({
  files,
  onOpen,
}: {
  files: readonly Attachment[]
  onOpen: (file: Attachment) => void
}) => {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {files.map(file => (
        <button
          type="button"
          key={file.fid}
          className="rounded-md text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpen(file)}
        >
          <AttachmentVisual file={file} />
        </button>
      ))}
    </div>
  )
}
