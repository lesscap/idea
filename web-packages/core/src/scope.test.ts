import { describe, expect, it } from 'vitest'
import { createScope } from './scope.ts'

// Disposal order is the whole point of this abstraction. If it stopped running
// in reverse, a pool would close while something still holding it was shutting
// down — a shutdown-only bug that no request-path test would ever catch.
describe('createScope', () => {
  it('disposes in reverse acquisition order', async () => {
    const order: string[] = []
    const scope = createScope()

    scope.use(['a', () => void order.push('a')])
    scope.use(['b', () => void order.push('b')])
    scope.use(['c', () => void order.push('c')])

    await scope.dispose()

    expect(order).toEqual(['c', 'b', 'a'])
  })

  it('awaits each async disposer before starting the next', async () => {
    const order: string[] = []
    const scope = createScope()

    scope.use([
      'slow',
      async () => {
        await new Promise(r => setTimeout(r, 20))
        order.push('slow')
      },
    ])
    scope.use(['fast', () => void order.push('fast')])

    await scope.dispose()

    // 'fast' disposes first (reverse order); 'slow' must still land after it
    // rather than racing past on its timer.
    expect(order).toEqual(['fast', 'slow'])
  })

  it('returns the resource value so wiring reads as assignment', () => {
    const scope = createScope()
    expect(scope.use([42, () => {}])).toBe(42)
  })

  it('does not re-run disposers if dispose is called twice', async () => {
    let calls = 0
    const scope = createScope()
    scope.use(['x', () => void calls++])

    await scope.dispose()
    await scope.dispose()

    expect(calls).toBe(1)
  })
})
