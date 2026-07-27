import * as Primitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn.ts'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger

export const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof Primitive.Content>) => (
  <Primitive.Portal>
    <Primitive.Content
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1',
        'text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
)

export const DropdownMenuItem = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) => (
  <Primitive.Item
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  />
)

export const DropdownMenuLabel = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) => (
  <Primitive.Label className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />
)

export const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) => (
  <Primitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
)
