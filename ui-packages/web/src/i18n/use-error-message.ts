import { useCallback } from 'react'
import { RequestError } from '../lib/request'
import { useLocale } from '.'

// Turns a thrown request failure into something worth showing a person.
//
// The server's `message` is English and written for developers ("an app with
// that name already exists in this workspace"). Passing it straight to the UI —
// which is what every catch block used to do — puts English sentences in a
// Chinese interface. The envelope's `code` is the part meant for branching, so
// that is what gets translated.
//
// `scope` narrows domain codes such as app name and slug conflicts. Falls back
// to the generic phrasing for that code, then to a catch-all, so an unmapped code
// degrades to vague rather than to blank.
export const useErrorMessage = () => {
  const __ = useLocale()

  return useCallback(
    (err: unknown, scope?: 'app'): string => {
      if (!(err instanceof RequestError)) {
        console.error('unexpected failure', err)
        return __('error.fallback')
      }

      // Keeps the developer-facing detail reachable without showing it.
      console.error(`request failed [${err.code}]`, err.message)

      const scoped = scope ? `${scope}.error.${err.code}` : null
      const generic = `error.${err.code}`

      // The key type cannot be checked here — it is assembled from a runtime
      // code — so `__` returning the key itself on a miss is what makes the
      // fallback chain work.
      const tryKey = (key: string): string | null => {
        const text = __(key as Parameters<typeof __>[0])
        return text === key ? null : text
      }

      return (scoped ? tryKey(scoped) : null) ?? tryKey(generic) ?? __('error.fallback')
    },
    [__],
  )
}
