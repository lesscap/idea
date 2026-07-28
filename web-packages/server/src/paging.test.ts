import { describe, expect, it } from 'vitest'
import { MAX_PAGE_SIZE, paged, parsePageQuery, toOffset } from './paging.ts'

// Query parsing is the security-relevant half: `pageSize` reaches the database
// as a LIMIT, and `page` becomes an OFFSET. Unclamped, `?pageSize=1000000` is a
// free way to make the server haul the whole table into memory, and `?page=0`
// or `?page=-1` produces a negative offset that most drivers reject outright.
describe('parsePageQuery', () => {
  it('defaults to the first page at the default size', () => {
    expect(parsePageQuery({})).toEqual({ page: 1, pageSize: 20 })
  })

  it('caps pageSize so a client cannot request the whole table', () => {
    expect(parsePageQuery({ pageSize: '1000000' }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('floors page at 1 so the offset can never go negative', () => {
    expect(parsePageQuery({ page: '0' }).page).toBe(1)
    expect(parsePageQuery({ page: '-5' }).page).toBe(1)
  })

  it('floors pageSize at 1 rather than producing an empty LIMIT 0', () => {
    expect(parsePageQuery({ pageSize: '0' }).pageSize).toBe(1)
  })

  it('falls back to defaults on unparseable input instead of erroring', () => {
    expect(parsePageQuery({ page: 'abc', pageSize: '' })).toEqual({ page: 1, pageSize: 20 })
  })

  it('truncates fractional input to a whole page', () => {
    expect(parsePageQuery({ page: '2.9' }).page).toBe(2)
  })
})

describe('toOffset', () => {
  it('translates page/pageSize into offset/limit', () => {
    expect(toOffset({ page: 3, pageSize: 20 })).toEqual({ offset: 40, limit: 20 })
  })

  it('starts the first page at offset zero', () => {
    expect(toOffset({ page: 1, pageSize: 20 })).toEqual({ offset: 0, limit: 20 })
  })
})

describe('paged', () => {
  // The echo is what lets a clamped client tell. It also means a reader working
  // out whether more pages exist can trust the pageSize it was handed back,
  // rather than the one it asked for.
  it('echoes the effective query back so a clamped client can tell', () => {
    const query = parsePageQuery({ pageSize: '99999' })
    expect(paged([], 0, query).pageSize).toBe(MAX_PAGE_SIZE)
  })
})
