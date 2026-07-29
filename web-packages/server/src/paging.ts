import type { Paged, PageQuery } from '@idea/shared'

// Reading a page request off a query string, and building the answer.
//
// @idea/shared holds `Paged<T>` and `PageQuery` — the shapes the browser
// compiles against — and nothing that produces them: it is the interface
// contract between the two runtimes and carries no logic. Only the server ever
// parses a query string or counts rows, so that half lives here.

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

type RawQuery = Record<string, string | undefined>

const toInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)

// Clamps rather than rejects. A list endpoint answering 400 because someone
// asked for 5000 rows is unhelpful; answering with the maximum is. The response
// echoes the effective `pageSize` back, so a client that asked for more can see
// what it actually got instead of guessing.
//
// Mainly safety rather than manners: `pageSize` becomes a SQL LIMIT, so leaving
// it open is a full-table read for the asking.
//
// Unparseable input falls back to the default for the same reason — `?page=abc`
// should show page 1, not an error page.
export const parsePageQuery = (query: RawQuery): PageQuery => ({
  page: clamp(toInt(query.page, 1), 1, Number.MAX_SAFE_INTEGER),
  pageSize: clamp(toInt(query.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE),
})

// Offset/limit rather than Prisma's skip/take: nothing here should have to know
// which ORM the caller happens to use, so the mapping stays at the call site.
export const toOffset = ({ page, pageSize }: PageQuery): { offset: number; limit: number } => ({
  offset: (page - 1) * pageSize,
  limit: pageSize,
})

export const paged = <T>(items: readonly T[], total: number, query: PageQuery): Paged<T> => ({
  items,
  total,
  page: query.page,
  pageSize: query.pageSize,
})
