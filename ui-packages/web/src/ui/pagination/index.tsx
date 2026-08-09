import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../button'

export type PaginationProps = {
  page: number
  total: number
  pageSize: number
  ariaLabel: string
  previousLabel: string
  nextLabel: string
  totalLabel: string
  pageLabel: (page: number) => string
  className?: string
  testIdPrefix?: string
  onPageChange: (page: number) => void
}

type PageItem = number | 'start-gap' | 'end-gap'

const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index)

const pageItems = (page: number, totalPages: number): readonly PageItem[] => {
  if (totalPages <= 7) return range(1, totalPages)
  if (page <= 4) return [1, 2, 3, 4, 5, 'end-gap', totalPages]
  if (page >= totalPages - 3) {
    return [1, 'start-gap', ...range(totalPages - 4, totalPages)]
  }
  return [1, 'start-gap', page - 1, page, page + 1, 'end-gap', totalPages]
}

export const Pagination = ({
  page,
  total,
  pageSize,
  ariaLabel,
  previousLabel,
  nextLabel,
  totalLabel,
  pageLabel,
  className,
  testIdPrefix,
  onPageChange,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const testId = (suffix: string): string | undefined =>
    testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined

  return (
    <div
      className={cn('flex min-w-0 items-center justify-end gap-3 sm:justify-between', className)}
      data-testid={testIdPrefix}
      data-page={page}
      data-total-pages={totalPages}
    >
      <p className="hidden shrink-0 text-muted-foreground text-sm sm:block">{totalLabel}</p>
      <nav className="flex max-w-full items-center gap-1 overflow-x-auto" aria-label={ariaLabel}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-8 shrink-0 p-0"
          disabled={page <= 1}
          aria-label={previousLabel}
          data-testid={testId('previous')}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>

        {pageItems(page, totalPages).map(item =>
          typeof item === 'number' ? (
            <Button
              key={item}
              type="button"
              variant={item === page ? 'secondary' : 'ghost'}
              size="sm"
              className="size-8 shrink-0 p-0"
              aria-label={pageLabel(item)}
              aria-current={item === page ? 'page' : undefined}
              data-testid={testId(`page-${item}`)}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ) : (
            <span
              key={item}
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-8 shrink-0 p-0"
          disabled={page >= totalPages}
          aria-label={nextLabel}
          data-testid={testId('next')}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  )
}
