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

export const listRequirements = (appId: Id, page = 1): Promise<Paged<RequirementSummary>> =>
  get<Paged<RequirementSummary>>(`${requirementsPath(appId)}?page=${page}`)

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
