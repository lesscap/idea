// Paging lives *inside* the envelope's `data`, not beside it:
//
//   { success: true, data: { items, total, page, pageSize } }
//
// so a paged response is an ordinary ApiResponse<Paged<T>> and every existing
// helper — ok(), isOk(), the browser request wrapper — works on it unchanged.
// Putting the counts in a sibling `meta` key would force every consumer to
// learn a second envelope shape for the sake of one field group.
export type Paged<T> = {
  readonly items: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export type PageQuery = {
  readonly page: number
  readonly pageSize: number
}

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
// Unparseable input falls back to the default for the same reason — `?page=abc`
// should show page 1, not an error page.
export const parsePageQuery = (query: RawQuery): PageQuery => ({
  page: clamp(toInt(query.page, 1), 1, Number.MAX_SAFE_INTEGER),
  pageSize: clamp(toInt(query.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE),
})

// Offset/limit, not Prisma's skip/take: this package stays ORM-neutral and the
// server maps it at the call site.
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

// Derived, never stored — a `totalPages` field on the payload would be one more
// thing that can disagree with `total` and `pageSize`.
export const totalPages = ({
  total,
  pageSize,
}: Pick<Paged<unknown>, 'total' | 'pageSize'>): number =>
  pageSize > 0 ? Math.ceil(total / pageSize) : 0
