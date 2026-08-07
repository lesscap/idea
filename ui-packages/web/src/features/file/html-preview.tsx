import { Code2, Eye } from 'lucide-react'
import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'

type ViewMode = 'preview' | 'source'

export const HtmlPreview = ({ source, filename }: { source: string; filename: string }) => {
  const __ = useLocale()
  const [mode, setMode] = useState<ViewMode>('preview')

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="html-preview">
      <div className="flex h-9 shrink-0 items-center gap-1 border-border border-b bg-muted/30 px-2">
        <Button
          type="button"
          variant={mode === 'preview' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 px-2"
          aria-pressed={mode === 'preview'}
          onClick={() => setMode('preview')}
        >
          <Eye />
          {__('file.preview')}
        </Button>
        <Button
          type="button"
          variant={mode === 'source' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 px-2"
          aria-pressed={mode === 'source'}
          onClick={() => setMode('source')}
        >
          <Code2 />
          {__('file.source')}
        </Button>
      </div>

      {mode === 'preview' ? (
        <iframe
          title={__('file.htmlPreviewTitle', filename)}
          srcDoc={source}
          sandbox=""
          referrerPolicy="no-referrer"
          className="min-h-0 flex-1 border-0 bg-white"
          data-testid="html-preview-frame"
        />
      ) : (
        <pre
          className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4 font-mono text-xs leading-relaxed"
          data-testid="html-source"
        >
          {source}
        </pre>
      )}
    </div>
  )
}
