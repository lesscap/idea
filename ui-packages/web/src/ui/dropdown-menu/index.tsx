import * as Primitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

// Icons inside menu rows carry the same constraint Button applies. Without it
// lucide falls back to its own 24px default next to 14px text, which is what
// every menu here looked like until now. It belongs on the primitive rather than
// on each call site — the alternative is remembering it at every use, forever.
const ROW_ICON = '[&_svg]:size-4 [&_svg]:shrink-0'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger
export const DropdownMenuRadioGroup = Primitive.RadioGroup
export const DropdownMenuItemIndicator = Primitive.ItemIndicator

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
      ROW_ICON,
      className,
    )}
    {...props}
  />
)

export const DropdownMenuRadioItem = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) => (
  <Primitive.RadioItem
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      ROW_ICON,
      className,
    )}
    {...props}
  />
)

export const DropdownMenuCheckboxItem = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.CheckboxItem>) => (
  <Primitive.CheckboxItem
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      ROW_ICON,
      className,
    )}
    {...props}
  />
)

export const DropdownMenuLabel = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) => (
  <Primitive.Label
    className={cn('flex items-center gap-2 px-2 py-1.5 text-sm font-semibold', ROW_ICON, className)}
    {...props}
  />
)

export const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) => (
  <Primitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
)

export const DropdownMenuSub = Primitive.Sub

export const DropdownMenuSubTrigger = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.SubTrigger>) => (
  <Primitive.SubTrigger
    className={cn(
      'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent',
      ROW_ICON,
      className,
    )}
    {...props}
  />
)

export const DropdownMenuSubContent = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.SubContent>) => (
  <Primitive.Portal>
    <Primitive.SubContent
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1',
        'text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
)
