import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type DataTableColumn } from './index'

type Person = {
  id: string
  name: string
}

const columns: ReadonlyArray<DataTableColumn<Person>> = [{ accessorKey: 'name', header: 'Name' }]

describe('data table', () => {
  it('renders headers and activates a row with mouse or keyboard', () => {
    const onActivate = vi.fn()
    const person = { id: '1', name: 'Ada' }
    render(
      <DataTable
        ariaLabel="People"
        columns={columns}
        data={[person]}
        getRowId={row => row.id}
        getRowLabel={row => `Open ${row.name}`}
        rowTestId={row => `person-${row.id}`}
        onRowActivate={onActivate}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()

    const row = screen.getByTestId('person-1')
    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(onActivate).toHaveBeenNthCalledWith(1, person)
    expect(onActivate).toHaveBeenNthCalledWith(2, person)
  })

  it('renders the supplied empty state', () => {
    render(<DataTable ariaLabel="People" columns={columns} data={[]} emptyContent="No people" />)

    expect(screen.getByText('No people')).toBeInTheDocument()
  })
})
