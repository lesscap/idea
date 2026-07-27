import { describe, expect, it } from 'vitest'
import { cn } from './cn.ts'

// The only piece of real logic in the primitive layer, and the one whose failure
// is hardest to recognise: without the tailwind-merge step both classes survive
// and which one applies depends on stylesheet order rather than call order. The
// symptom is "the className prop sometimes doesn't work", which reads as a
// styling mystery rather than a bug in a utility.
describe('cn', () => {
  it('lets a later class override an earlier one in the same group', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  // The case that matters for components: a caller's className must beat the
  // component's own default.
  it('lets a caller override a component default', () => {
    const componentDefault = 'rounded-md bg-primary px-4'
    expect(cn(componentDefault, 'bg-destructive')).toBe('rounded-md px-4 bg-destructive')
  })

  it('keeps classes from different groups', () => {
    expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm')
  })

  it('resolves conditionals and ignores falsy values', () => {
    expect(cn('base', false && 'no', undefined, null, 'yes')).toBe('base yes')
  })

  it('accepts arrays and objects the way clsx does', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })
})
