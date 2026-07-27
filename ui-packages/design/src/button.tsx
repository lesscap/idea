import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: 'primary' | 'secondary'
  readonly children: ReactNode
}

// Styles read from the tokens rather than from Tailwind utilities: a component
// in this package must look right in any consumer, including ones that have not
// configured Tailwind to scan this source tree.
const base = {
  font: 'inherit',
  fontSize: 'var(--idea-text-base)',
  padding: 'var(--idea-space-2) var(--idea-space-4)',
  borderRadius: 'var(--idea-radius-md)',
  cursor: 'pointer',
  transition: 'background-color 120ms ease',
} as const

const variants = {
  primary: {
    background: 'var(--idea-color-accent)',
    color: 'var(--idea-color-accent-text)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--idea-color-surface)',
    color: 'var(--idea-color-text)',
    border: '1px solid var(--idea-color-border)',
  },
} as const

export const Button = ({ variant = 'primary', children, ...rest }: ButtonProps) => (
  <button type="button" style={{ ...base, ...variants[variant] }} {...rest}>
    {children}
  </button>
)
