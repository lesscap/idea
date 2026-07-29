import type { ApiFailure, ApiResponse } from '@idea/shared'
import { Hono } from 'hono'
import type { Controller, ServiceApplication, WebApplication } from '../../types.ts'
import { requireSession, type SessionData } from './middleware/session.ts'

// Mounts one controller with stubbed services and a fixed session, so a test can
// exercise routing and permission wiring without a database or a real cookie.
//
// If a controller test ever needs more than a stub here, the controller has
// grown a dependency it should not have.

type SessionStub = SessionData | null

// Stands in for @hono/session's middleware. The real one encrypts a cookie;
// tests only care that `c.var.session.get()` answers.
const fakeSession = (initial: SessionStub) => {
  let data = initial
  return async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('session', {
      get: async () => data,
      update: async (fn: (prev: SessionStub) => SessionData) => {
        data = fn(data)
      },
      delete: () => {
        data = null
      },
    })
    await next()
  }
}

// `guarded` mirrors how routes.ts mounts the controller. Controllers wrapped in
// `guarded` there rely on requireSession having run, so a test that omits it
// exercises a configuration that never ships.
export const mountController = (
  controller: Controller,
  services: Partial<ServiceApplication>,
  sessionData: SessionStub = null,
  { guarded = false }: { guarded?: boolean } = {},
): Hono => {
  const root = new Hono()
  root.use('*', fakeSession(sessionData) as never)
  const scoped = Object.assign(new Hono(), services) as WebApplication
  if (guarded) scoped.use('*', requireSession)
  controller(scoped)
  root.route('/', scoped)
  return root
}

export const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// Envelope readers. `res.json()` is `unknown`, and casting it inline at every
// assertion is noise that also hides which half of the envelope a test expects.
export const okData = async <T>(res: Response): Promise<T> => {
  const body = (await res.json()) as ApiResponse<T>
  // `success` is the discriminant, so this narrows on its own — no guard needed.
  if (!body.success) throw new Error(`expected success, got ${body.code}: ${body.message}`)
  return body.data
}

export const failure = async (res: Response): Promise<ApiFailure> =>
  (await res.json()) as ApiFailure
