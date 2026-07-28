import type { ApiFailure, ApiSuccess } from '@idea/shared'
import type { Context } from 'hono'

// The response envelope, and the HTTP statuses that carry it.
//
// @idea/shared holds the envelope's SHAPE and nothing else — it is the interface
// contract between the two runtimes, so it carries types and no logic. The
// server is the only thing that ever builds one, which puts the builders here,
// beside the statuses they go out with.
//
// Pairing code and status in one factory per failure is what stops `not_found`
// from going out as a 400 in one controller and a 404 in the next.
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500

const ok = <T>(data: T): ApiSuccess<T> => ({ success: true, data })

const fail = (code: string, message: string): ApiFailure => ({ success: false, code, message })

const failure = (c: Context, status: ErrorStatus, code: string, message: string) =>
  c.json(fail(code, message), status)

export const sendOk = <T>(c: Context, data: T) => c.json(ok(data))

export const badRequest = (c: Context, message: string) => failure(c, 400, 'bad_request', message)

export const unauthorized = (c: Context, message = 'authentication required') =>
  failure(c, 401, 'unauthorized', message)

export const forbidden = (c: Context, message = 'not permitted') =>
  failure(c, 403, 'forbidden', message)

export const notFound = (c: Context, message = 'not found') => failure(c, 404, 'not_found', message)

export const conflict = (c: Context, message: string) => failure(c, 409, 'conflict', message)

export const unprocessable = (c: Context, message: string) =>
  failure(c, 422, 'unprocessable', message)

// Deliberately does not take the caught error: whatever went wrong is for the
// log, not for the client. Leaking a stack or a driver message through the API
// is how connection strings end up in browser consoles.
export const internal = (c: Context, message = 'internal error') =>
  failure(c, 500, 'internal', message)

// Domain-specific failures that no generic factory covers. Callers pass their
// own code so the client can branch on it (`requirement_locked`), but still go
// through one place so the envelope stays identical.
export const failWith = (c: Context, status: ErrorStatus, code: string, message: string) =>
  failure(c, status, code, message)
