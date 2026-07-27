import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './home.tsx'

const mockFetch = (body: unknown, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )

afterEach(() => vi.unstubAllGlobals())

// Covers the request wrapper's two contracts through the page that uses it: a
// success envelope is unwrapped to domain values, and a failure envelope
// surfaces as an error rather than rendering as if it had succeeded.
describe('HomePage', () => {
  it('renders the health report from a success envelope', async () => {
    mockFetch({ success: true, data: { ok: true, db: 'up' } })

    render(<HomePage />)

    expect(await screen.findByText(/数据库 已连接/)).toBeInTheDocument()
  })

  it('renders a failure envelope as an error, not as a healthy state', async () => {
    mockFetch({ success: false, code: 'db_down', message: 'connection refused' }, 500)

    render(<HomePage />)

    expect(await screen.findByText(/连接失败：connection refused/)).toBeInTheDocument()
  })
})
