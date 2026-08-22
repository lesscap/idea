import type { Attachment, IssueContent } from '@idea/shared'
import { FileText, Paperclip } from 'lucide-react'
import { useLocale } from '../../i18n'
import { formatBytes } from '../../lib/format-bytes'
import { AppMarkdown } from '../../parts/app-markdown'
import styles from './style.module.scss'

export const IssueDocument = ({
  content,
  onOpenFile,
}: {
  content: IssueContent
  onOpenFile: (file: Attachment) => void
}) => {
  const __ = useLocale()
  return (
    <article>
      {content.body ? (
        <AppMarkdown
          text={content.body}
          files={content.images}
          className={styles.markdown}
          onOpenFile={onOpenFile}
        />
      ) : (
        <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
          <FileText className="size-4" />
          {__('issue.emptyBody')}
        </div>
      )}
      {content.attachments.length > 0 && (
        <section className="mt-8 border-border border-t pt-4">
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {__('issue.attachments')}
          </h2>
          <div className="divide-y divide-border rounded-md border border-border">
            {content.attachments.map(file => (
              <button
                key={file.fid}
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
                onClick={() => onOpenFile(file)}
              >
                <Paperclip className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{file.filename}</span>
                <span className="text-muted-foreground text-xs">{formatBytes(file.size)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
