import type { Attachment, Id, IssueLabel, IssueType } from '@idea/shared'
import { Image, Paperclip, X } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { uploadConversationFile } from '../file/upload'
import { useLocale } from '../../i18n'
import { useErrorMessage } from '../../i18n/use-error-message'
import { Button, Input } from '../../ui'
import type { IssueContentInput } from './api'
import { IssueMetadataFields } from './issue-metadata-fields'

export type IssueEditorValue = IssueContentInput & {
  readonly type: IssueType | null
  readonly labelIds: readonly Id[]
}

type IssueEditorProps = {
  readonly appId: Id
  readonly labels: readonly IssueLabel[]
  readonly initial?: {
    readonly title: string
    readonly body: string
    readonly type: IssueType | null
    readonly labels: readonly IssueLabel[]
    readonly images: readonly Attachment[]
    readonly attachments: readonly Attachment[]
  }
  readonly submitLabel: string
  readonly onCancel?: () => void
  readonly onSubmit: (value: IssueEditorValue) => Promise<void>
}

const asAttachment = ({ fid, filename, contentType, size }: Attachment): Attachment => ({
  fid,
  filename,
  contentType,
  size,
})

export const IssueEditor = ({
  appId,
  labels,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: IssueEditorProps) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const fileInput = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [type, setType] = useState<IssueType | null>(initial?.type ?? null)
  const [labelIds, setLabelIds] = useState<readonly Id[]>(
    initial?.labels.map(label => label.id) ?? [],
  )
  const [images, setImages] = useState<readonly Attachment[]>(initial?.images ?? [])
  const [attachments, setAttachments] = useState<readonly Attachment[]>(initial?.attachments ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const settled = await Promise.allSettled(
        [...files].map(file => uploadConversationFile({ type: 'app', appId }, file)),
      )
      const failed = settled.filter(result => result.status === 'rejected')
      failed.forEach(result => {
        console.error('issue file upload failed', result.reason)
      })
      const uploaded = settled.flatMap(result =>
        result.status === 'fulfilled' ? [result.value] : [],
      )
      const next = uploaded.map(asAttachment)
      const nextImages = next.filter(file => file.contentType.startsWith('image/'))
      const nextAttachments = next.filter(file => !file.contentType.startsWith('image/'))
      setImages(current => [...current, ...nextImages])
      setAttachments(current => [...current, ...nextAttachments])
      if (nextImages.length > 0) {
        const references = nextImages
          .map(file => `![${file.filename}](idea-file:${file.fid})`)
          .join('\n\n')
        setBody(current => `${current}${current ? '\n\n' : ''}${references}`)
      }
      if (failed.length > 0) setError(__('issue.someUploadsFailed', failed.length))
    } catch (caught) {
      console.error('issue file upload failed', caught)
      setError(__('issue.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || submitting || uploading) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        body,
        type,
        labelIds,
        imageFids: images.map(file => file.fid),
        attachmentFids: attachments.map(file => file.fid),
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]"
      aria-busy={submitting}
      onSubmit={submit}
    >
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="issue-title">
            {__('issue.title')}
          </label>
          <Input
            id="issue-title"
            value={title}
            maxLength={200}
            required
            autoFocus
            placeholder={__('issue.titlePlaceholder')}
            onChange={event => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="issue-body">
            {__('issue.description')}
          </label>
          <textarea
            id="issue-body"
            className="min-h-64 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={body}
            maxLength={100_000}
            placeholder={__('issue.descriptionPlaceholder')}
            onChange={event => setBody(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">{__('issue.markdownHint')}</p>
        </div>
        <div className="space-y-2">
          <span className="font-medium text-sm">{__('issue.files')}</span>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            disabled={uploading}
            onChange={event => void addFiles(event.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip />
              {uploading ? __('issue.uploading') : __('issue.addFiles')}
            </Button>
            {[...images, ...attachments].map(file => (
              <span
                key={file.fid}
                className="inline-flex max-w-64 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                {file.contentType.startsWith('image/') ? (
                  <Image className="size-3.5" />
                ) : (
                  <Paperclip className="size-3.5" />
                )}
                <span className="truncate">{file.filename}</span>
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={__('issue.removeFile', file.filename)}
                  onClick={() => {
                    setImages(current => current.filter(item => item.fid !== file.fid))
                    setAttachments(current => current.filter(item => item.fid !== file.fid))
                  }}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <aside className="border-border border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        <IssueMetadataFields
          idPrefix="issue-editor"
          type={type}
          labelIds={labelIds}
          labels={labels}
          disabled={submitting}
          onTypeChange={setType}
          onLabelIdsChange={setLabelIds}
        />
      </aside>
      {error && (
        <p className="text-destructive text-sm lg:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-border border-t bg-background py-4 lg:col-span-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {__('common.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={!title.trim() || submitting || uploading}>
          {submitting ? __('common.loading') : submitLabel}
        </Button>
      </div>
    </form>
  )
}
