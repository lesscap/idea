import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceUrl,
  closeTab,
  openTab,
  parseWorkspaceUrl,
  type WorkspaceUrl,
} from './workspace-url'

const at = (url: string): WorkspaceUrl => {
  const [pathname, search = ''] = url.split('?')
  return parseWorkspaceUrl({ pathname: pathname ?? '/', search })
}

describe('the grammar round-trips', () => {
  it('survives a full workspace state', () => {
    const url = '/requirements/R-1?cid=42&tab=requirements/R-1&tab=apps/7'
    expect(buildWorkspaceUrl(at(url))).toBe(url)
  })

  it('keeps the local new-conversation sentinel in the URL', () => {
    expect(buildWorkspaceUrl(at('/?cid=new'))).toBe('/?cid=new')
  })

  // Percent-encoding is cosmetic on the way out and irrelevant on the way in.
  // That asymmetry is what lets the generator emit readable URLs without making
  // every other producer of a link match its style.
  it('reads an escaped ref the same as a literal one', () => {
    expect(at('/?tab=apps%2F7').tabs).toEqual(at('/?tab=apps/7').tabs)
  })

  // Why the tab set is a repeated key and not a comma-separated list: a list
  // needs a separator, and no amount of escaping saves it, because
  // URLSearchParams decodes before handing the value over — an escaped comma is
  // already a literal one by the time there is anything to split.
  it('treats a ref containing the old separator as a single tab', () => {
    const state = openTab(at('/'), 'files/a,b.ts')
    const url = buildWorkspaceUrl(openTab(state, 'apps/7'))

    expect(at(url).tabs).toEqual(['files/a,b.ts', 'apps/7'])
  })
})

describe('path and tabs divide the work', () => {
  // Hand-typing a resource path has to just work — nobody composes a tabs
  // parameter by hand before visiting a link someone read out to them.
  it('opens a bare path as a tab', () => {
    expect(at('/requirements/R-1').tabs).toEqual(['requirements/R-1'])
  })

  it('drops the tab parameter while it says nothing new', () => {
    expect(buildWorkspaceUrl(at('/requirements/R-1'))).toBe('/requirements/R-1')
  })

  // The reason the tab set includes the active ref rather than listing the
  // others: switching leaves the set untouched, so order can never drift.
  it('leaves the tab set byte-identical when only the active tab changes', () => {
    const two = at('/requirements/R-1?tab=requirements/R-1&tab=apps/7')
    const switched = buildWorkspaceUrl(openTab(two, 'apps/7'))

    expect(switched).toBe('/apps/7?tab=requirements/R-1&tab=apps/7')
  })

  // This runs on the Shell's render path with nothing catching above it, so a
  // URIError here is a blank page rather than a bad tab.
  it('survives a malformed escape instead of taking the page down', () => {
    expect(() => at('/foo%bar')).not.toThrow()
    expect(at('/foo%bar').active).toBe('foo%bar')
  })

  // Not reachable through openTab/closeTab, which both keep active in the set —
  // pinned because parse is what makes it converge, and that is easy to lose.
  it('converges when handed an active ref missing from its own tab set', () => {
    const odd = { active: 'apps/7', tabs: ['members'], conversationId: null, extra: [] }
    const once = at(buildWorkspaceUrl(odd))

    expect(once.tabs).toEqual(['members', 'apps/7'])
    expect(at(buildWorkspaceUrl(once)).tabs).toEqual(['members', 'apps/7'])
  })

  it('never opens the same resource twice', () => {
    const once = openTab(at('/'), 'apps/7')
    expect(openTab(once, 'apps/7').tabs).toEqual(['apps/7'])
  })

  // Query parameters belonging to someone else must survive our writes, or every
  // future feature that adds one has to teach this module about it.
  it('carries unknown query parameters through a tab change', () => {
    const url = buildWorkspaceUrl(
      closeTab(at('/apps/7?from=email&tab=apps/7&tab=members'), 'apps/7'),
    )
    expect(url).toContain('from=email')
  })
})

describe('closing a tab', () => {
  const three = at('/apps/7?tab=requirements/R-1&tab=apps/7&tab=members')

  it('leaves the main area alone when the tab was in the background', () => {
    const after = closeTab(three, 'requirements/R-1')

    expect(after.active).toBe('apps/7')
    expect(after.tabs).toEqual(['apps/7', 'members'])
  })

  it('moves to the right neighbour when the active tab goes', () => {
    expect(closeTab(three, 'apps/7').active).toBe('members')
  })

  it('falls back to the left when there is nothing to the right', () => {
    expect(closeTab(three, 'members').active).toBe('apps/7')
  })

  // Closing the last tab is the empty main area, not a special case: the
  // conversation is untouched and the URL is still shareable.
  it('empties the main area when the last tab closes, keeping the conversation', () => {
    const alone = at('/apps/7?cid=42')

    expect(buildWorkspaceUrl(closeTab(alone, 'apps/7'))).toBe('/?cid=42')
  })
})
