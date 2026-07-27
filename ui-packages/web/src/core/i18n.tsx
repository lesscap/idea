import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

// The i18n mechanism. Deliberately knows nothing about this application's
// messages: not a single import points at a message file, so this module could
// be lifted into another project unchanged.
//
// Messages are data, injected by the assembly layer (src/i18n). That separation
// is what makes "load translations from an API later" a change of one file
// rather than a change everywhere — the consumer side never learns where
// messages came from.

// A message tree is arbitrarily nested objects bottoming out in strings.
export type MessageTree = { [key: string]: string | MessageTree }

// Flattens a nested tree into the union of its dotted paths, so a key can be
// checked at compile time even though it is written as a string. This is the
// main thing a hand-rolled i18n can offer over i18next, whose `t('a.b')` is only
// validated at runtime — and it would be a shame to give it up merely because
// the call is a function rather than a property access.
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type Translate<M> = (key: MessageKey<M>, ...args: (string | number)[]) => string

const lookup = (tree: MessageTree, path: string): string | undefined => {
  const found = path.split('.').reduce<string | MessageTree | undefined>((node, part) => {
    if (node === undefined || typeof node === 'string') return undefined
    return node[part]
  }, tree)
  return typeof found === 'string' ? found : undefined
}

// Positional placeholders — `{0}`, `{1}` — rather than named ones, because
// languages order their clauses differently ("7 天后过期" vs "expires in 7
// days") and the translation has to be free to move them.
const interpolate = (template: string, args: (string | number)[]): string =>
  template.replace(/\{(\d+)\}/g, (whole, index: string) => {
    const value = args[Number(index)]
    return value === undefined ? whole : String(value)
  })

export type LocaleApi<M extends MessageTree, L extends string> = {
  LocaleProvider: (props: { initial?: L; children: ReactNode }) => ReactElement
  useLocale: () => Translate<M>
  useLocaleControl: () => { locale: L; setLocale: (next: L) => void; available: L[] }
}

/**
 * Builds a locale context around the bundles it is handed. The key type is
 * inferred from those bundles, so `__('app.creat')` fails to compile — the
 * mechanism stays generic while the call sites stay checked.
 */
// Generic over the bundle map rather than over <messages, locale> separately:
// `Record<L, M>` makes TypeScript infer L from the first key alone, so a second
// language is rejected as an unknown property.
export const createLocale = <B extends Record<string, MessageTree>>(
  bundles: B,
  fallback: keyof B & string,
): LocaleApi<B[keyof B], keyof B & string> => {
  type L = keyof B & string
  type M = B[keyof B]
  type Ctx = { locale: L; messages: M; setLocale: (next: L) => void }
  const LocaleContext = createContext<Ctx | null>(null)
  const available = Object.keys(bundles) as L[]

  const LocaleProvider = ({ initial, children }: { initial?: L; children: ReactNode }) => {
    const [locale, setLocale] = useState<L>(initial && bundles[initial] ? initial : fallback)
    const value = useMemo<Ctx>(
      () => ({ locale, messages: bundles[locale] ?? bundles[fallback], setLocale }),
      [locale],
    )
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  }

  const useCtx = (): Ctx => {
    const ctx = useContext(LocaleContext)
    if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
    return ctx
  }

  const useLocale = (): Translate<M> => {
    const { messages } = useCtx()
    return useCallback(
      (key, ...args) => {
        const template = lookup(messages, key)
        // Falling back to the key itself makes a missing message obvious in the
        // UI rather than rendering as an empty gap nobody notices.
        if (template === undefined) return key
        return args.length > 0 ? interpolate(template, args) : template
      },
      [messages],
    )
  }

  const useLocaleControl = () => {
    const { locale, setLocale } = useCtx()
    return { locale, setLocale, available }
  }

  return { LocaleProvider, useLocale, useLocaleControl }
}
