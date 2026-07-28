// The single response envelope crossing the HTTP boundary. Server handlers
// return it, the browser request wrapper narrows it. A discriminated union
// rather than `{ data?, error? }` so `success` alone tells the compiler which
// half is present — no optional-chaining at every call site.
//
// Shape only. Building one is the server's job (server/src/http.ts) and reading
// one is a `body.success` test at either end; neither belongs here, because this
// package is the interface contract and carries no logic.
export type ApiSuccess<T> = { success: true; data: T }

// `code` is a stable machine-readable string the client can branch on; `message`
// is human-facing text that may change freely. Kept flat rather than nested
// under `error` — one less level to reach through, and the union already makes
// it unambiguous which fields exist.
export type ApiFailure = { success: false; code: string; message: string }

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure
