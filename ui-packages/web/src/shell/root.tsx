import { useEffect } from 'react'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import { SessionStoreProvider } from '../core/session/store.tsx'
import { useLoadSession } from '../core/session/use-session.ts'
import { routes } from './routes.tsx'

// Resolves the session once, before anything decides whether to redirect.
// Guards render nothing while status is 'loading', so this is what unblocks the
// first paint.
const Routed = () => {
  const load = useLoadSession()
  useEffect(() => {
    void load()
  }, [load])
  return useRoutes(routes)
}

export const Root = () => (
  <SessionStoreProvider>
    <BrowserRouter>
      <Routed />
    </BrowserRouter>
  </SessionStoreProvider>
)
