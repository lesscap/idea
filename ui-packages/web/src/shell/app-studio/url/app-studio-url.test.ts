import { describe, expect, it } from 'vitest'
import { buildAppStudioUrl, closeTab, openTab, parseAppStudioUrl } from './app-studio-url'

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
    const withRequirements = openTab(initial, 'requirements')
    const withDetail = openTab(withRequirements, 'requirements/R-1')

    expect(buildAppStudioUrl(withDetail)).toBe(
      '/apps/payroll/dashboard/requirements/R-1?cid=cid-1&tab=overview&tab=requirements&tab=requirements/R-1',
    )
    expect(closeTab(withDetail, 'requirements/R-1')).toMatchObject({
      active: 'requirements',
      tabs: ['overview', 'requirements'],
      conversationId: 'cid-1',
    })
  })

  it('falls back to Overview after closing the last resource', () => {
    const requirements = parseAppStudioUrl({
      pathname: '/apps/payroll/dashboard/requirements',
      search: '',
    })

    expect(closeTab(requirements, 'requirements')).toMatchObject({
      active: 'overview',
      tabs: ['overview'],
    })
    expect(buildAppStudioUrl(closeTab(requirements, 'requirements'))).toBe(
      '/apps/payroll/dashboard/overview',
    )
  })
})
