// The route path grammar. Three orthogonal things share one URL:
//
//   /requirements/R-1?cid=42&tab=requirements/R-1&tab=apps/7
//   └──────┬───────┘ └──┬──┘ └───────────┬───────────────┘
//      active tab    conversation       open tab set
//
// Two parameters, two jobs: the path decides *which* tab is active, `tab`
// decides membership and order — and neither does the other's job. That split is
// what makes switching tabs leave the tab set byte-identical, and closing a
// background tab leave the path untouched.
//
// One repeated parameter rather than one comma-separated list. A list needs a
// separator, a separator needs an escape, and the escape cannot work:
// URLSearchParams.get() decodes before returning, so an escaped comma is already
// a literal one by the time there is anything to split. Repeating the key has no
// separator to confuse — 'files/a,b.ts' is simply one value.
//
// Deliberately free of React. Every screen depends on these semantics, and they
// are checkable without a DOM, so they get pinned down here rather than
// rediscovered through the UI.

export type WorkspaceUrl = {
  /** Ref of the tab filling the main area. Null at '/', where it is empty. */
  active: string | null
  /** Ordered, and always contains `active`. May be absent from the URL — see buildWorkspaceUrl. */
  tabs: readonly string[]
  /** Conversation shown in the side panel; null when the panel is closed. */
  conversationId: string | null
  /** Query parameters this module does not own, carried through untouched. */
  extra: [string, string][]
}

/** The location fields this module reads — structurally what useLocation() returns. */
export type UrlParts = { pathname: string; search: string }

const OWNED = new Set(['cid', 'tab'])

// A ref is a resource path minus its leading slash: 'requirements/R-1'.
//
// Slashes and commas are left literal. Refs are full of slashes
// (files/src/app.ts), and this URL *is* the workspace state — one that cannot be
// read cannot be hand-edited or checked by an agent, which is the whole point.
// Both characters are legal in a query per RFC 3986, and with no separator to
// confuse, neither can change how the value parses.
const encodeRef = (ref: string) =>
  encodeURIComponent(ref).replace(/%2F/gi, '/').replace(/%2C/gi, ',')

// decodeURIComponent throws a URIError on a malformed escape ('/foo%bar'), and
// this runs on the Shell's render path with no error boundary above it — so an
// unescaped percent sign anywhere in the address would take the whole page down.
// Browsers normalise what gets typed and buildWorkspaceUrl escapes what it
// emits, so nothing here produces one; a hand-assembled link or a pushState can.
// A ref that will not decode is worth far less than a working page: fall through
// to the raw text, which lands on the recoverable "unknown resource" state.
const decodeRef = (raw: string) => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const parseWorkspaceUrl = ({ pathname, search }: UrlParts): WorkspaceUrl => {
  const params = new URLSearchParams(search)
  const path = pathname.replace(/^\/+/, '')
  const active = path === '' ? null : decodeRef(path)
  const listed = params.getAll('tab').filter(ref => ref !== '')

  return {
    active,
    // The path wins: a hand-typed '/requirements/R-1' carries no tab parameter
    // and still has to open as one.
    tabs: active !== null && !listed.includes(active) ? [...listed, active] : listed,
    conversationId: params.get('cid') || null,
    extra: [...params].filter(([key]) => !OWNED.has(key)),
  }
}

export const buildWorkspaceUrl = ({
  active,
  tabs,
  conversationId,
  extra,
}: WorkspaceUrl): string => {
  // Dropped while it says nothing the path does not — parsing appends the active
  // ref back. Keeps the ordinary single-tab URL short, so the parameter appears
  // only once it carries real information.
  const redundant = tabs.length === 0 || (tabs.length === 1 && tabs[0] === active)

  const query = [
    ...(conversationId ? [`cid=${encodeURIComponent(conversationId)}`] : []),
    ...(redundant ? [] : tabs.map(ref => `tab=${encodeRef(ref)}`)),
    ...extra.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`),
  ].join('&')

  return `${active === null ? '/' : `/${encodeRef(active)}`}${query === '' ? '' : `?${query}`}`
}

// Opening and activating are one operation: clicking a tab that is already open
// just makes it active. Nothing can be open twice.
export const openTab = (url: WorkspaceUrl, ref: string): WorkspaceUrl => ({
  ...url,
  active: ref,
  tabs: url.tabs.includes(ref) ? url.tabs : [...url.tabs, ref],
})

export const closeTab = (url: WorkspaceUrl, ref: string): WorkspaceUrl => {
  const index = url.tabs.indexOf(ref)
  if (index < 0) return url

  const tabs = url.tabs.filter(open => open !== ref)
  // Closing a background tab must not move the main area.
  if (url.active !== ref) return { ...url, tabs }

  // Right neighbour first: reading runs that way, and it matches how closing a
  // browser tab behaves. Falls back to the left, then to the empty main area.
  return { ...url, tabs, active: url.tabs[index + 1] ?? url.tabs[index - 1] ?? null }
}
