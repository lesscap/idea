import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '.'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

const SelectHarness = () => {
  const [value, setValue] = useState('bug')
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="Issue type">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bug">Bug</SelectItem>
        <SelectItem value="feature">Feature</SelectItem>
      </SelectContent>
    </Select>
  )
}

describe('Select', () => {
  it('changes and displays its controlled value', async () => {
    render(<SelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Issue type' })
    expect(trigger).toHaveTextContent('Bug')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Feature' }))

    expect(trigger).toHaveTextContent('Feature')
  })

  it('exposes disabled and invalid states', () => {
    render(
      <Select disabled defaultValue="bug">
        <SelectTrigger aria-label="Issue type" aria-invalid="true">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bug">Bug</SelectItem>
        </SelectContent>
      </Select>,
    )

    expect(screen.getByRole('combobox', { name: 'Issue type' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Issue type' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})
