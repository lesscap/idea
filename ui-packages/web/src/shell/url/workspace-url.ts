// The URL is the workbench state. The app slug is the tenant-local application
// context; the resource path, conversation and open tabs remain orthogonal.

export type WorkspaceUrl = {
  readonly slug: string
  readonly active: string | null
  readonly tabs: readonly string[]
  readonly conversationId: string | null
  readonly conversationInPath: boolean
  readonly extra: readonly [string, string][]
}

export type UrlParts = { pathname: string; search: string }

const OWNED = new Set(['cid', 'tab'])

const encodeRef = (ref: string) =>
  encodeURIComponent(ref).replace(/%2F/gi, '/').replace(/%2C/gi, ',')

const decodeRef = (raw: string) => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const parseWorkspaceUrl = ({ pathname, search }: UrlParts): WorkspaceUrl => {
  const params = new URLSearchParams(search)
  const [, rawSlug = '', rawPath = ''] = pathname.match(/^\/apps\/([^/]+)(?:\/(.*))?$/) ?? []
  const conversation = rawPath.match(/^conversation\/([^/]+)$/)
  const active = rawPath === '' || conversation ? null : decodeRef(rawPath)
  const listed = params.getAll('tab').filter(ref => ref !== '')

  return {
    slug: decodeRef(rawSlug),
    active,
    tabs: active !== null && !listed.includes(active) ? [...listed, active] : listed,
    conversationId: conversation ? decodeRef(conversation[1] ?? '') : params.get('cid') || null,
    conversationInPath: conversation !== null,
    extra: [...params].filter(([key]) => !OWNED.has(key)),
  }
}

export const buildWorkspaceUrl = ({
  slug,
  active,
  tabs,
  conversationId,
  conversationInPath,
  extra,
}: WorkspaceUrl): string => {
  const base = `/apps/${encodeURIComponent(slug)}`
  const pathname =
    conversationInPath && conversationId
      ? `${base}/conversation/${encodeURIComponent(conversationId)}`
      : active === null
        ? base
        : `${base}/${encodeRef(active)}`
  const redundant = tabs.length === 0 || (tabs.length === 1 && tabs[0] === active)

  const query = [
    ...(!conversationInPath && conversationId ? [`cid=${encodeURIComponent(conversationId)}`] : []),
    ...(redundant ? [] : tabs.map(ref => `tab=${encodeRef(ref)}`)),
    ...extra.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`),
  ].join('&')

  return `${pathname}${query === '' ? '' : `?${query}`}`
}

export const openTab = (url: WorkspaceUrl, ref: string): WorkspaceUrl => ({
  ...url,
  active: ref,
  tabs: url.tabs.includes(ref) ? url.tabs : [...url.tabs, ref],
  conversationInPath: false,
})

export const closeTab = (url: WorkspaceUrl, ref: string): WorkspaceUrl => {
  const index = url.tabs.indexOf(ref)
  if (index < 0) return url

  const tabs = url.tabs.filter(open => open !== ref)
  if (url.active !== ref) return { ...url, tabs }

  const active = url.tabs[index + 1] ?? url.tabs[index - 1] ?? null
  return {
    ...url,
    tabs,
    active,
    conversationInPath: active === null && url.conversationId !== null,
  }
}

export const showConversation = (
  url: WorkspaceUrl,
  conversationId: string | null,
): WorkspaceUrl => ({
  ...url,
  conversationId,
  conversationInPath: conversationId !== null && url.active === null,
})

export const showHome = (url: WorkspaceUrl): WorkspaceUrl => ({
  ...url,
  active: null,
  tabs: [],
  conversationInPath: false,
})
