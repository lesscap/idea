import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './index'

const draw = (page: number, total: number, onPageChange = vi.fn()) => {
  render(
    <Pagination
      page={page}
      total={total}
      pageSize={20}
      ariaLabel="Pagination"
      previousLabel="Previous"
      nextLabel="Next"
      totalLabel={`${total} total`}
      pageLabel={number => `Page ${number}`}
      testIdPrefix="test-pagination"
      onPageChange={onPageChange}
    />,
  )
  return onPageChange
}

describe('pagination', () => {
  it('shows every page in a short result and disables the first boundary', () => {
    draw(1, 60)

    expect(screen.getByTestId('test-pagination-previous')).toBeDisabled()
    expect(screen.getByTestId('test-pagination-next')).toBeEnabled()
    expect(screen.getByTestId('test-pagination-page-1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('test-pagination-page-3')).toBeInTheDocument()
  })

  it('windows a long result around the current page', () => {
    draw(6, 240)

    expect(screen.getByTestId('test-pagination-page-1')).toBeInTheDocument()
    expect(screen.getByTestId('test-pagination-page-5')).toBeInTheDocument()
    expect(screen.getByTestId('test-pagination-page-6')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('test-pagination-page-7')).toBeInTheDocument()
    expect(screen.getByTestId('test-pagination-page-12')).toBeInTheDocument()
    expect(screen.getAllByText('…')).toHaveLength(2)
  })

  it('changes pages and disables the last boundary', () => {
    const onPageChange = draw(3, 60)

    expect(screen.getByTestId('test-pagination-next')).toBeDisabled()
    fireEvent.click(screen.getByTestId('test-pagination-page-2'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
