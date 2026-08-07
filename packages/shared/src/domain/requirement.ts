import type { Id } from '../ids.ts'

export type RequirementStatus = 'draft' | 'active' | 'archived'

export type RequirementContent = {
  readonly title: string
  readonly summary: string
  readonly body: string
}

export type RequirementDraft = RequirementContent & {
  readonly version: number
  readonly updatedAt: string
  readonly updatedInConversationCid: string | null
}

export type RequirementRevisionSummary = {
  readonly id: Id
  readonly version: number
  readonly code: string
  readonly confirmedAt: string
}

export type RequirementRevision = RequirementContent &
  RequirementRevisionSummary & {
    readonly confirmedInConversationCid: string | null
  }

export type RequirementSummary = {
  readonly id: Id
  readonly number: number
  readonly code: string
  readonly status: RequirementStatus
  readonly title: string
  readonly summary: string
  readonly currentRevisionCode: string | null
  readonly hasDraft: boolean
  readonly updatedAt: string
}

export type RequirementDetail = {
  readonly id: Id
  readonly number: number
  readonly code: string
  readonly status: RequirementStatus
  readonly draft: RequirementDraft | null
  readonly currentRevision: RequirementRevision | null
  readonly revisions: readonly RequirementRevisionSummary[]
  readonly createdAt: string
  readonly updatedAt: string
}
