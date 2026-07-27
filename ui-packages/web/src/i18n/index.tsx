import { createLocale } from '../core/i18n'
import { en } from './messages/en'
import { zh } from './messages/zh'

// Assembly: hands the mechanism in core/i18n.tsx this application's messages and
// re-exports the result already bound to their types. Components import from
// here, never from core/i18n directly.
//
// Swapping these bundles for something fetched from an API later changes this
// file and nothing else.

export type Locale = 'zh' | 'en'

export const LOCALE_NAMES: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
}

export const { LocaleProvider, useLocale, useLocaleControl } = createLocale({ zh, en }, 'zh')

// For the few places that pass translation around as a value rather than
// calling it in place — the resource registry names its tabs from plain data,
// so it takes the translator as an argument instead of being a hook.
export type Translate = ReturnType<typeof useLocale>
export type MessageId = Parameters<Translate>[0]

const STORAGE_KEY = 'idea.locale'

// localStorage is right for language and was wrong for workspaceId, and the
// difference is what a leftover value does. A stale workspaceId points the next
// person who signs in at a workspace they may not belong to; a stale language
// just shows an unexpected interface that they can change in one click.
export const readStoredLocale = (): Locale | undefined => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    return raw === 'zh' || raw === 'en' ? raw : undefined
  } catch {
    // Private mode or storage disabled — degrade to "not remembered".
    return undefined
  }
}

export const storeLocale = (locale: Locale): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Same as above: failing to persist a preference is not worth an error.
  }
}

// Falls back to the browser's language when nothing has been chosen, rather
// than forcing a default the user never picked.
export const detectLocale = (): Locale =>
  readStoredLocale() ?? (globalThis.navigator?.language?.startsWith('zh') ? 'zh' : 'en')
