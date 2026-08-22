export type AppStudioUrl = {
  readonly slug: string
  readonly active: string
  readonly tabs: readonly string[]
  readonly conversationId: string | null
  readonly extra: readonly [string, string][]
}

export type UrlParts = { pathname: string; search: string }

const OWNED = new Set(['cid', 'tab'])
const DEFAULT_RESOURCE = 'overview'
const encodeRef = (ref: string) =>
  encodeURIComponent(ref).replace(/%2F/gi, '/').replace(/%2C/gi, ',')
const decodeRef = (raw: string) => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const parseAppStudioUrl = ({ pathname, search }: UrlParts): AppStudioUrl => {
  const params = new URLSearchParams(search)
  const [, rawSlug = '', rawPath = ''] =
    pathname.match(/^\/apps\/([^/]+)\/dashboard(?:\/(.*))?$/) ?? []
  const active = rawPath === '' ? DEFAULT_RESOURCE : decodeRef(rawPath)
  const listed = params.getAll('tab').filter(Boolean)
  return {
    slug: decodeRef(rawSlug),
    active,
    tabs: listed.includes(active) ? listed : [...listed, active],
    conversationId: params.get('cid') || null,
    extra: [...params].filter(([key]) => !OWNED.has(key)),
  }
}

export const buildAppStudioUrl = (url: AppStudioUrl): string => {
  const base = `/apps/${encodeURIComponent(url.slug)}/dashboard/${encodeRef(url.active)}`
  const redundant = url.tabs.length === 1 && url.tabs[0] === url.active
  const query = [
    ...(url.conversationId ? [`cid=${encodeURIComponent(url.conversationId)}`] : []),
    ...(redundant ? [] : url.tabs.map(ref => `tab=${encodeRef(ref)}`)),
    ...url.extra.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`),
  ].join('&')
  return `${base}${query ? `?${query}` : ''}`
}

export const openTab = (url: AppStudioUrl, ref: string): AppStudioUrl => ({
  ...url,
  active: ref,
  tabs: url.tabs.includes(ref) ? url.tabs : [...url.tabs, ref],
})

export const replaceTab = (url: AppStudioUrl, ref: string): AppStudioUrl => ({
  ...url,
  active: ref,
  tabs: url.tabs
    .map(open => (open === url.active ? ref : open))
    .filter((open, index, tabs) => tabs.indexOf(open) === index),
})

export const closeTab = (url: AppStudioUrl, ref: string): AppStudioUrl => {
  const index = url.tabs.indexOf(ref)
  if (index < 0) return url
  const remaining = url.tabs.filter(open => open !== ref)
  const tabs = remaining.length === 0 ? [DEFAULT_RESOURCE] : remaining
  return {
    ...url,
    tabs,
    active:
      url.active === ref
        ? (remaining[index] ?? remaining[index - 1] ?? DEFAULT_RESOURCE)
        : url.active,
  }
}

export const showConversation = (url: AppStudioUrl, conversationId: string): AppStudioUrl => ({
  ...url,
  conversationId,
})
