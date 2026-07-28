// Paging lives *inside* the envelope's `data`, not beside it:
//
//   { success: true, data: { items, total, page, pageSize } }
//
// so a paged response is an ordinary ApiResponse<Paged<T>>: the server builds it
// with the same envelope helper as anything else, and the browser unwraps it
// with the same request wrapper. Putting the counts in a sibling `meta` key
// would force every consumer to learn a second envelope shape for the sake of
// one field group.
//
// `totalPages` is deliberately absent — deriving it from `total` and `pageSize`
// where it is needed keeps one less field that can disagree with them.
export type Paged<T> = {
  readonly items: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

// What the server settled on after reading the query string, echoed back inside
// `Paged` so a client that asked for more than the maximum can see what it got.
// Parsing and clamping live in server/src/paging.ts.
export type PageQuery = {
  readonly page: number
  readonly pageSize: number
}
