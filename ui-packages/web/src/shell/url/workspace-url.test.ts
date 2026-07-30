import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceUrl,
  closeTab,
  openTab,
  parseWorkspaceUrl,
  showHome,
  type WorkspaceUrl,
} from './workspace-url'

const at = (url: string): WorkspaceUrl => {
  const [pathname, search = ''] = url.split('?')
  return parseWorkspaceUrl({ pathname: pathname ?? '/', search })
}

describe('the app workbench URL', () => {
  it('round-trips a resource, conversation and repeated tabs', () => {
    const url =
      '/apps/leave-request/requirements/R-1?cid=abc123&tab=requirements/R-1&tab=files/a.ts'
    expect(buildWorkspaceUrl(at(url))).toBe(url)
  })

  it('reads standalone drafts and conversations from the path', () => {
    expect(at('/apps/leave-request/conversation/new')).toMatchObject({
      slug: 'leave-request',
      active: null,
      conversationId: 'new',
      conversationInPath: true,
    })
    expect(buildWorkspaceUrl(at('/apps/leave-request/conversation/cid123'))).toBe(
      '/apps/leave-request/conversation/cid123',
    )
  })

  it('lets a conversation path override a conflicting query value', () => {
    expect(at('/apps/a/conversation/path-id?cid=query-id').conversationId).toBe('path-id')
  })

  it('moves an attached conversation back to its standalone path after the last tab closes', () => {
    const state = at('/apps/a/requirements/R-1?cid=cid123')
    expect(buildWorkspaceUrl(closeTab(state, 'requirements/R-1'))).toBe(
      '/apps/a/conversation/cid123',
    )
  })

  it('keeps the conversation attached when navigating home', () => {
    const state = at('/apps/a/requirements/R-1?cid=cid123')
    expect(buildWorkspaceUrl(showHome(state))).toBe('/apps/a?cid=cid123')
  })

  it('keeps refs containing commas intact', () => {
    const state = openTab(at('/apps/a'), 'files/a,b.ts')
    expect(at(buildWorkspaceUrl(state)).tabs).toEqual(['files/a,b.ts'])
  })
})
