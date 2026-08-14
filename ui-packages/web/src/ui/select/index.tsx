import * as Primitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

export const Select = Primitive.Root
export const SelectValue = Primitive.Value

export const SelectTrigger = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) => (
  <Primitive.Trigger
    className={cn(
      'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
      'outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive',
      className,
    )}
    {...props}
  >
    {children}
    <Primitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Primitive.Icon>
  </Primitive.Trigger>
)

export const SelectContent = ({
  className,
  children,
  position = 'popper',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof Primitive.Content>) => (
  <Primitive.Portal>
    <Primitive.Content
      position={position}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden',
        'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    >
      <Primitive.Viewport className="p-1">{children}</Primitive.Viewport>
    </Primitive.Content>
  </Primitive.Portal>
)

export const SelectItem = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Item>) => (
  <Primitive.Item
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <Primitive.ItemText>{children}</Primitive.ItemText>
    <span className="absolute right-2 flex size-4 items-center justify-center">
      <Primitive.ItemIndicator>
        <Check className="size-4" aria-hidden="true" />
      </Primitive.ItemIndicator>
    </span>
  </Primitive.Item>
)
