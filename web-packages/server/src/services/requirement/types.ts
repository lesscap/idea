import type {
  Id,
  Paged,
  PageQuery,
  RequirementContent,
  RequirementDetail,
  RequirementRevision,
  RequirementSummary,
} from '@idea/shared'

export type RequirementScope = {
  readonly workspaceId: Id
  readonly appId: Id
}

export type RequirementListQuery = PageQuery & {
  readonly search?: string
}

export type CreateRequirementInput = RequirementScope &
  RequirementContent & {
    readonly createdById: Id
    readonly conversationCid?: string
  }

export type SaveRequirementDraftInput = RequirementScope &
  RequirementContent & {
    readonly requirementId: Id
    readonly updatedById: Id
    readonly conversationCid?: string
  }

export type ConfirmRequirementInput = RequirementScope & {
  readonly requirementId: Id
  readonly confirmedById: Id
  readonly expectedDraftVersion: number
  readonly conversationCid?: string
}

export type RequirementWriteFailure =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'conversation_not_found' }
  | { readonly kind: 'archived' }
  | { readonly kind: 'draft_missing' }
  | { readonly kind: 'draft_version_conflict' }

export type RequirementWriteResult =
  | { readonly kind: 'ok'; readonly requirement: RequirementDetail }
  | RequirementWriteFailure

export type RequirementCommandResult =
  | { readonly kind: 'ok'; readonly requirementId: Id }
  | RequirementWriteFailure

export type RequirementReads = {
  list: (scope: RequirementScope, query: RequirementListQuery) => Promise<Paged<RequirementSummary>>
  get: (scope: RequirementScope, requirementId: Id) => Promise<RequirementDetail | null>
  byCode: (
    scope: RequirementScope,
    code: string,
  ) => Promise<{ readonly id: Id; readonly code: string } | null>
  revision: (
    scope: RequirementScope,
    requirementId: Id,
    revisionId: Id,
  ) => Promise<RequirementRevision | null>
}

export type RequirementCommands = {
  create: (input: CreateRequirementInput) => Promise<RequirementCommandResult>
  saveDraft: (input: SaveRequirementDraftInput) => Promise<RequirementCommandResult>
  confirm: (input: ConfirmRequirementInput) => Promise<RequirementCommandResult>
}

export type RequirementService = RequirementReads & {
  create: (input: CreateRequirementInput) => Promise<RequirementWriteResult>
  saveDraft: (input: SaveRequirementDraftInput) => Promise<RequirementWriteResult>
  confirm: (input: ConfirmRequirementInput) => Promise<RequirementWriteResult>
}
