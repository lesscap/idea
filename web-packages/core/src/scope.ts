// A service that owns a real resource (a connection pool, a timer, a socket)
// returns a `Resource`: the value plus how to release it. `scope.use` unwraps
// the value and remembers the disposer, so wiring code reads as plain
// assignment while teardown stays in one place.
export type Dispose = () => void | Promise<void>
export type Resource<T> = readonly [value: T, dispose: Dispose]

export type Scope = {
  use<T>(resource: Resource<T>): T
  dispose(): Promise<void>
}

export const createScope = (): Scope => {
  const disposers: Dispose[] = []
  return {
    use: <T>([value, dispose]: Resource<T>): T => {
      disposers.push(dispose)
      return value
    },
    // Reverse order: a resource acquired later may depend on an earlier one, so
    // it has to go first. Sequential await — releases must not race.
    dispose: async () => {
      for (const dispose of disposers.splice(0).reverse()) {
        await dispose()
      }
    },
  }
}
