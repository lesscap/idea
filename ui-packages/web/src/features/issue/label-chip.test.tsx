import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LabelChip } from './label-chip'

describe('label chip contrast', () => {
  it('selects the higher-contrast foreground', () => {
    const dark = render(
      <LabelChip label={{ id: 1, name: 'dark', description: null, color: 'b60205' }} />,
    )
    const light = render(
      <LabelChip label={{ id: 2, name: 'light', description: null, color: 'fef2c0' }} />,
    )

    expect(dark.getByText('dark')).toHaveStyle({ color: '#ffffff' })
    expect(light.getByText('light')).toHaveStyle({ color: '#111827' })
  })
})
