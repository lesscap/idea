import { describe, expect, it } from 'vitest'
import {
  buildAppStudioUrl,
  closeTab,
  openTab,
  parseAppStudioUrl,
  replaceTab,
} from './app-studio-url'

describe('app studio url', () => {
  it('treats Overview as a regular Dashboard resource', () => {
    expect(
      parseAppStudioUrl({ pathname: '/apps/payroll/dashboard/overview', search: '' }),
    ).toMatchObject({
      slug: 'payroll',
      active: 'overview',
      tabs: ['overview'],
      conversationId: null,
    })
  })

  it('keeps conversation and resource tabs orthogonal', () => {
    const initial = parseAppStudioUrl({
      pathname: '/apps/payroll/dashboard/overview',
      search: '?cid=cid-1',
    })
    const withIssues = openTab(initial, 'issues')
    const withDetail = openTab(withIssues, 'issues/1')

    expect(buildAppStudioUrl(withDetail)).toBe(
      '/apps/payroll/dashboard/issues/1?cid=cid-1&tab=overview&tab=issues&tab=issues/1',
    )
    expect(closeTab(withDetail, 'issues/1')).toMatchObject({
      active: 'issues',
      tabs: ['overview', 'issues'],
      conversationId: 'cid-1',
    })
  })

  it('falls back to Overview after closing the last resource', () => {
    const issues = parseAppStudioUrl({
      pathname: '/apps/payroll/dashboard/issues',
      search: '',
    })

    expect(closeTab(issues, 'issues')).toMatchObject({
      active: 'overview',
      tabs: ['overview'],
    })
    expect(buildAppStudioUrl(closeTab(issues, 'issues'))).toBe('/apps/payroll/dashboard/overview')
  })

  it('replaces a transient create tab with the created issue', () => {
    const creating = parseAppStudioUrl({
      pathname: '/apps/payroll/dashboard/issues/new',
      search: '?tab=overview&tab=issues/new',
    })

    expect(replaceTab(creating, 'issues/42')).toMatchObject({
      active: 'issues/42',
      tabs: ['overview', 'issues/42'],
    })
  })
})
