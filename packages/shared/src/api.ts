// The single response envelope crossing the HTTP boundary. Server handlers
// return it, the browser request wrapper narrows it. A discriminated union
// rather than `{ data?, error? }` so `success` alone tells the compiler which
// half is present — no optional-chaining at every call site.
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string }

export const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data })

export const fail = (code: string, message: string): ApiResponse<never> => ({
  success: false,
  code,
  message,
})

export const isOk = <T>(res: ApiResponse<T>): res is { success: true; data: T } => res.success
