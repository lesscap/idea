import type {
  Id,
  Paged,
  RequirementDetail,
  RequirementRevision,
  RequirementSummary,
} from '@idea/shared'
import { get } from '../../lib/request'

export type RequirementIdentity = Pick<RequirementSummary, 'id' | 'code'>

const requirementsPath = (appId: Id): string => `/apps/${encodeURIComponent(appId)}/requirements`

export const requirementResourceRef = (code: string): string => `requirements/${code}`

export const listRequirements = (
  appId: Id,
  query: { readonly page: number; readonly search: string },
): Promise<Paged<RequirementSummary>> => {
  const params = new URLSearchParams({ page: String(query.page), pageSize: '20' })
  if (query.search !== '') params.set('q', query.search)
  return get<Paged<RequirementSummary>>(`${requirementsPath(appId)}?${params}`)
}

export const getRequirementByCode = (appId: Id, code: string): Promise<RequirementIdentity> =>
  get<RequirementIdentity>(`${requirementsPath(appId)}/by-code/${encodeURIComponent(code)}`)

export const getRequirement = (appId: Id, requirementId: Id): Promise<RequirementDetail> =>
  get<RequirementDetail>(`${requirementsPath(appId)}/${encodeURIComponent(requirementId)}`)

export const getRequirementRevision = (
  appId: Id,
  requirementId: Id,
  revisionId: Id,
): Promise<RequirementRevision> =>
  get<RequirementRevision>(
    `${requirementsPath(appId)}/${encodeURIComponent(requirementId)}/revisions/${encodeURIComponent(revisionId)}`,
  )
