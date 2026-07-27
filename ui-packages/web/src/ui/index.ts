// UI primitives — the one entry point the rest of the app imports from.
//
// The rule that used to be enforced by a package boundary, now enforced by
// convention and a grep in CI: nothing under ui/ may know a domain type. No
// imports from @idea/shared, core/, or features/. A component that needs
// structured data takes primitive props from its caller.
//
// The test for belonging here: could this be dropped into an entirely different
// product unchanged? If not, it belongs to a feature.
export { Avatar } from './avatar/index.tsx'
export { Badge, type BadgeProps } from './badge/index.tsx'
export { Button, type ButtonProps, buttonVariants } from './button/index.tsx'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card/index.tsx'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog/index.tsx'
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu/index.tsx'
export { Input } from './input/index.tsx'
export { Label } from './label/index.tsx'
