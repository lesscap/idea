import type { Attachment } from '@idea/shared'
import type { ComponentProps } from 'react'
import { defaultUrlTransform, type UrlTransform } from 'react-markdown'
import { useLocale } from '../../i18n'
import { Markdown } from '../../ui'

const IDEA_FILE = 'idea-file:'

const internalImageUrl = (fid: string): string => `/api/web/files/${encodeURIComponent(fid)}`

export const AppMarkdown = ({
  text,
  files = [],
  className,
  onOpenFile,
}: {
  text: string
  files?: readonly Attachment[]
  className?: string
  onOpenFile?: (file: Attachment) => void
}) => {
  const __ = useLocale()
  const images = files.filter(file => file.contentType.startsWith('image/'))
  const byFid = new Map(images.map(file => [file.fid, file]))
  const byUrl = new Map(images.map(file => [internalImageUrl(file.fid), file]))
  const transform: UrlTransform = (url, key, _node) => {
    if (key !== 'src') return defaultUrlTransform(url)
    if (!url.startsWith(IDEA_FILE)) return null
    const file = byFid.get(url.slice(IDEA_FILE.length))
    return file ? internalImageUrl(file.fid) : null
  }
  const Image = ({ src, alt }: ComponentProps<'img'>) => {
    const file = typeof src === 'string' ? byUrl.get(src) : undefined
    if (!file) {
      return (
        <span role="img" aria-label={alt ?? ''} data-markdown-image-unavailable="true">
          {__('issue.imageUnavailable')}
        </span>
      )
    }

    const image = (
      <img
        src={src}
        alt={alt ?? file.filename}
        loading="lazy"
        decoding="async"
        data-markdown-image="true"
      />
    )
    if (!onOpenFile) return image
    return (
      <button
        type="button"
        className="block max-w-full cursor-zoom-in text-left"
        aria-label={__('issue.openImage', file.filename)}
        onClick={() => onOpenFile(file)}
      >
        {image}
      </button>
    )
  }

  return (
    <Markdown
      text={text}
      className={className}
      urlTransform={transform}
      components={{ img: Image }}
    />
  )
}
