import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useState,
  type WheelEvent,
} from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../ui'

const MIN_SCALE = 0.1
const MAX_SCALE = 10

type Point = { readonly x: number; readonly y: number }

export const ImagePreview = ({ src, alt }: { src: string; alt: string }) => {
  const __ = useLocale()
  const [scale, setScale] = useState(1)
  const [fitted, setFitted] = useState(true)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<Point | null>(null)

  const resetPosition = (nextScale: number) => {
    setScale(nextScale)
    setPosition({ x: 0, y: 0 })
  }

  const fitImage = () => {
    setFitted(true)
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const actualSize = () => {
    setFitted(false)
    resetPosition(1)
  }

  const zoom = (factor: number) => {
    setScale(current => Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor)))
  }

  const move = (event: MouseEvent<HTMLButtonElement>) => {
    if (!dragStart) return
    setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })
  }

  const keyControl = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === '+' || event.key === '=') zoom(1.2)
    else if (event.key === '-') zoom(1 / 1.2)
    else if (event.key === '0') actualSize()
    else if (event.key.toLowerCase() === 'f') fitImage()
    else if (event.key === 'ArrowLeft') setPosition(current => ({ ...current, x: current.x - 20 }))
    else if (event.key === 'ArrowRight') setPosition(current => ({ ...current, x: current.x + 20 }))
    else if (event.key === 'ArrowUp') setPosition(current => ({ ...current, y: current.y - 20 }))
    else if (event.key === 'ArrowDown') setPosition(current => ({ ...current, y: current.y + 20 }))
    else return
    event.preventDefault()
  }

  const control = (label: string, icon: ReactNode, action: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      title={label}
      onClick={action}
    >
      {icon}
    </Button>
  )

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-muted/20"
      data-testid="image-preview"
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-md border border-border bg-background p-1 shadow-sm">
        {control(__('file.zoomIn'), <ZoomIn />, () => zoom(1.2))}
        {control(__('file.zoomOut'), <ZoomOut />, () => zoom(1 / 1.2))}
        {control(__('file.fit'), <Maximize2 />, fitImage)}
        {control(__('file.actualSize'), <RotateCcw />, actualSize)}
        <span className="min-w-12 px-1 text-center tabular-nums text-muted-foreground text-xs">
          {Math.round(scale * 100)}%
        </span>
      </div>

      <button
        type="button"
        aria-label={__('file.imageCanvas')}
        className={`flex h-full w-full items-center justify-center overflow-hidden border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${dragStart ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={(event: WheelEvent<HTMLButtonElement>) => {
          event.preventDefault()
          zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1)
        }}
        onMouseDown={event => {
          if (event.button !== 0) return
          setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y })
        }}
        onMouseMove={move}
        onMouseUp={() => setDragStart(null)}
        onMouseLeave={() => setDragStart(null)}
        onKeyDown={keyControl}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`pointer-events-none select-none motion-reduce:transition-none ${
            fitted ? 'max-h-full max-w-full' : 'max-h-none max-w-none'
          } ${dragStart ? '' : 'transition-transform duration-150 ease-out'}`}
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
        />
      </button>
    </div>
  )
}
