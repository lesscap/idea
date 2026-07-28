import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
  sendOk,
  unauthorized,
} from './http.ts'

// The point of these helpers is that every failure leaves the server looking
// identical. A drifting status (`not_found` answered as 400) or a stray field
// breaks client branching in a way no single endpoint's test would notice, so
// the contract is pinned here rather than per controller.
const cases = [
  { name: 'badRequest', handler: badRequest, status: 400, code: 'bad_request' },
  { name: 'unauthorized', handler: unauthorized, status: 401, code: 'unauthorized' },
  { name: 'forbidden', handler: forbidden, status: 403, code: 'forbidden' },
  { name: 'notFound', handler: notFound, status: 404, code: 'not_found' },
  { name: 'conflict', handler: conflict, status: 409, code: 'conflict' },
  { name: 'internal', handler: internal, status: 500, code: 'internal' },
] as const

describe('failure helpers', () => {
  for (const { name, handler, status, code } of cases) {
    it(`${name} answers ${status} with code "${code}" and nothing else`, async () => {
      const app = new Hono()
      app.get('/', c => handler(c, 'boom'))

      const res = await app.request('/')

      expect(res.status).toBe(status)
      // Exact equality, not a subset match: an extra field leaking into the
      // error envelope is precisely what this guards against.
      expect(await res.json()).toEqual({ success: false, code, message: 'boom' })
    })
  }

  it('does not echo internal detail when no message is supplied', async () => {
    const app = new Hono()
    app.get('/', c => internal(c))

    expect(await (await app.request('/')).json()).toEqual({
      success: false,
      code: 'internal',
      message: 'internal error',
    })
  })
})

// The other half of the same contract. Pinned for the same reason: the browser
// reads `success` to decide which half it is holding, so the flag has to be
// there and the payload has to sit under `data` rather than at the top level.
describe('the success half', () => {
  it('puts the data under `data` and says so', async () => {
    const app = new Hono()
    app.get('/', c => sendOk(c, { name: 'idea' }))

    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { name: 'idea' } })
  })
})
