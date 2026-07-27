import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// clsx resolves conditionals; twMerge then drops earlier Tailwind classes that a
// later one overrides. Without the merge, `cn('p-2', 'p-4')` emits both and
// which one wins depends on stylesheet order rather than on call order — so a
// component's `className` prop would fail to override its own defaults.
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
