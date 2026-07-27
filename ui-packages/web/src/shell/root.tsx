import { useEffect } from 'react'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import { SessionStoreProvider } from '../core/session/store'
import { useLoadSession } from '../core/session/use-session'
import { detectLocale, LocaleProvider } from '../i18n'
import { routes } from './routes'

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

// Locale is resolved before first paint from localStorage or the browser, so the
// login screen is already in the right language — the one screen where a wrong
// language is most costly, since someone who cannot read it cannot get past it.
export const Root = () => (
  <LocaleProvider initial={detectLocale()}>
    <SessionStoreProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </SessionStoreProvider>
  </LocaleProvider>
)
