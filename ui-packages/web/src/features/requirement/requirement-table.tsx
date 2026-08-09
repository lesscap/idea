import type { RequirementSummary } from '@idea/shared'
import { ArrowRight } from 'lucide-react'
import { type Ref, useMemo } from 'react'
import { useLocale } from '../../i18n'
import { Badge, DataTable, type DataTableColumn } from '../../ui'

const statusClass: Record<RequirementSummary['status'], string> = {
  draft: 'border-warning/40 bg-warning/10 text-foreground',
  active: 'border-success/30 bg-success/10 text-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}

export const RequirementTable = ({
  items,
  dateFormatter,
  viewportRef,
  onOpen,
}: {
  items: ReadonlyArray<RequirementSummary>
  dateFormatter: Intl.DateTimeFormat
  viewportRef: Ref<HTMLDivElement>
  onOpen: (code: string) => void
}) => {
  const __ = useLocale()
  const columns = useMemo<ReadonlyArray<DataTableColumn<RequirementSummary>>>(
    () => [
      {
        accessorKey: 'code',
        header: __('requirement.columns.code'),
        size: 96,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground text-xs">{row.original.code}</span>
        ),
      },
      {
        accessorKey: 'title',
        header: __('requirement.columns.requirement'),
        size: 420,
        cell: ({ row }) => {
          const title = row.original.title || __('requirement.untitled')
          return (
            <span className="block min-w-0" title={title}>
              <span className="block truncate font-medium leading-5">{title}</span>
              {row.original.summary && (
                <span
                  className="block truncate text-muted-foreground text-xs leading-4"
                  title={row.original.summary}
                >
                  {row.original.summary}
                </span>
              )}
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: __('requirement.columns.status'),
        size: 112,
        cell: ({ row }) => (
          <Badge variant="outline" className={statusClass[row.original.status]}>
            {__(`requirement.status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        id: 'version',
        header: __('requirement.columns.version'),
        size: 176,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-mono text-muted-foreground text-xs">
              {row.original.currentRevisionCode ?? '—'}
            </span>
            {row.original.hasDraft && (
              <Badge
                variant="outline"
                className="truncate border-warning/40 bg-warning/10 text-foreground"
              >
                {__('requirement.hasDraft')}
              </Badge>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: __('requirement.columns.updatedAt'),
        size: 152,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground text-xs">
            {dateFormatter.format(new Date(row.original.updatedAt))}
          </span>
        ),
      },
      {
        id: 'open',
        header: () => <span className="sr-only">{__('requirement.columns.open')}</span>,
        size: 40,
        cell: () => (
          <ArrowRight
            className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ),
      },
    ],
    [__, dateFormatter],
  )

  return (
    <DataTable
      ariaLabel={__('requirement.tableLabel')}
      columns={columns}
      data={items}
      getRowId={row => row.code}
      getRowLabel={row => __('requirement.openRequirement', row.code)}
      minWidth={996}
      rowDataAttributes={row => ({
        'data-status': row.status,
        'data-has-draft': row.hasDraft,
      })}
      rowTestId={row => `requirement-${row.code.toLowerCase()}`}
      testId="requirement-table-viewport"
      viewportRef={viewportRef}
      onRowActivate={row => onOpen(row.code)}
    />
  )
}
