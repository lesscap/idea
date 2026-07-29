import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { SharedStoreProvider, useSharedStore, useSharedStoreApi } from './store'

const wrap = (ui: ReactNode) => render(<SharedStoreProvider>{ui}</SharedStoreProvider>)

const Reader = () => {
  const status = useSharedStore(s => s.status)
  return <span data-testid="status">{status}</span>
}

const Writer = () => {
  const store = useSharedStoreApi()
  return (
    <button type="button" onClick={() => store.setState({ status: 'ready' })}>
      ready
    </button>
  )
}

describe('SharedStoreProvider', () => {
  // The reason for the provider rather than a module-level `create()`: a
  // singleton keeps its state between tests, so one test's sign-in silently
  // changes what the next one sees.
  it('gives each provider its own state', async () => {
    const first = wrap(
      <>
        <Reader />
        <Writer />
      </>,
    )
    await act(async () => {
      first.getByRole('button').click()
    })
    expect(first.getByTestId('status').textContent).toBe('ready')

    // A second, independent tree must start clean.
    const second = wrap(<Reader />)
    expect(second.getAllByTestId('status').at(-1)?.textContent).toBe('loading')
  })

  // Reaching the store without a provider is a wiring mistake that would
  // otherwise show up as a confusing "cannot read property of null".
  it('fails loudly when used outside a provider', () => {
    expect(() => render(<Reader />)).toThrow(/must be used within SharedStoreProvider/)
  })

  it('only re-renders subscribers of the field that changed', async () => {
    let statusRenders = 0
    const StatusOnly = () => {
      useSharedStore(s => s.status)
      statusRenders++
      return null
    }
    const UserWriter = () => {
      const store = useSharedStoreApi()
      return (
        <button type="button" onClick={() => store.setState({ workspaceId: 5 })}>
          workspace
        </button>
      )
    }

    wrap(
      <>
        <StatusOnly />
        <UserWriter />
      </>,
    )
    const before = statusRenders

    await act(async () => {
      screen.getByRole('button').click()
    })

    // workspaceId changed; a component selecting only `status` must not re-render.
    expect(statusRenders).toBe(before)
  })
})
