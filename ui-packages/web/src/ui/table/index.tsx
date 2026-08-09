import {
  type ColumnDef,
  columnSizingFeature,
  coreFeatures,
  type RowData,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { cn } from '../../lib/cn'

const dataTableFeatures = tableFeatures({
  ...coreFeatures,
  columnSizingFeature,
})

type DataAttributes = {
  readonly [key: `data-${string}`]: string | number | boolean | undefined
}

export type DataTableColumn<TData extends RowData> = ColumnDef<
  typeof dataTableFeatures,
  TData,
  unknown
>

export type DataTableProps<TData extends RowData> = {
  ariaLabel: string
  columns: ReadonlyArray<DataTableColumn<TData>>
  data: ReadonlyArray<TData>
  emptyContent?: ReactNode
  getRowId?: (row: TData) => string
  getRowLabel?: (row: TData) => string
  minWidth?: number
  onRowActivate?: (row: TData) => void
  rowDataAttributes?: (row: TData) => DataAttributes
  rowTestId?: (row: TData) => string
  testId?: string
  viewportRef?: Ref<HTMLDivElement>
  className?: string
}

export const DataTable = <TData extends RowData>({
  ariaLabel,
  columns,
  data,
  emptyContent,
  getRowId,
  getRowLabel,
  minWidth = 720,
  onRowActivate,
  rowDataAttributes,
  rowTestId,
  testId,
  viewportRef,
  className,
}: DataTableProps<TData>) => {
  const table = useTable({ features: dataTableFeatures, columns, data, getRowId })
  const leafColumns = table.getAllLeafColumns()

  const activateFromKeyboard = (event: KeyboardEvent<HTMLTableRowElement>, row: TData) => {
    if (!onRowActivate || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onRowActivate(row)
  }

  return (
    <div
      ref={viewportRef}
      className={cn('min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain', className)}
      data-testid={testId}
    >
      <table
        className="w-full table-fixed border-collapse text-sm tabular-nums"
        style={{ minWidth }}
        aria-label={ariaLabel}
      >
        <colgroup>
          {leafColumns.map(column => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-border border-b">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  className="h-9 whitespace-nowrap px-3 text-left font-medium text-muted-foreground text-xs"
                  scope="col"
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              className={cn(
                'group border-border border-b transition-colors',
                onRowActivate &&
                  'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              )}
              tabIndex={onRowActivate ? 0 : undefined}
              aria-label={getRowLabel?.(row.original)}
              {...rowDataAttributes?.(row.original)}
              data-testid={rowTestId?.(row.original)}
              data-row-id={row.id}
              onClick={onRowActivate ? () => onRowActivate(row.original) : undefined}
              onKeyDown={event => activateFromKeyboard(event, row.original)}
            >
              {row.getAllCells().map(cell => (
                <td key={cell.id} className="h-13 overflow-hidden px-3 py-2 align-middle">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={leafColumns.length} className="h-56 px-4 text-center">
                {emptyContent}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
