// UI primitives — the one entry point the rest of the app imports from.
//
// The rule that used to be enforced by a package boundary, now enforced by
// convention and a grep in CI: nothing under ui/ may know a domain type. No
// imports from @idea/shared, core/, or features/. A component that needs
// structured data takes primitive props from its caller.
//
// The test for belonging here: could this be dropped into an entirely different
// product unchanged? If not, it belongs to a feature.
export { Avatar } from './avatar'
export { Badge, type BadgeProps } from './badge'
export { Button, type ButtonProps, buttonVariants } from './button'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'
export { Input } from './input'
export { Label } from './label'
export { Markdown } from './markdown'
