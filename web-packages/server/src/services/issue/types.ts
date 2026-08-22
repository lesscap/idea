import type {
  Id,
  IssueCloseReason,
  IssueContent,
  IssueDetail,
  IssueHistoryEntry,
  IssueLabel,
  IssueRevision,
  IssueState,
  IssueSummary,
  IssueType,
  Paged,
  PageQuery,
} from '@idea/shared'

export type IssueScope = { readonly workspaceId: Id; readonly appId: Id }

export type IssueListQuery = PageQuery & {
  readonly state: IssueState
  readonly type?: IssueType
  readonly labelIds?: readonly Id[]
  readonly search?: string
}

type ContentInput = Omit<IssueContent, 'images' | 'attachments'> & {
  readonly imageFids?: readonly string[]
  readonly attachmentFids?: readonly string[]
}

export type CreateIssueInput = IssueScope &
  ContentInput & {
    readonly createdById: Id
    readonly type: IssueType | null
    readonly labelIds?: readonly Id[]
  }

export type UpdateIssueInput = IssueScope &
  ContentInput & {
    readonly issueNumber: number
    readonly expectedUpdatedAt: string
    readonly updatedById: Id
    readonly type: IssueType | null
    readonly labelIds: readonly Id[]
  }

export type SetIssueTypeInput = IssueScope & {
  readonly issueNumber: number
  readonly actorId: Id
  readonly type: IssueType | null
}

export type SetIssueLabelsInput = IssueScope & {
  readonly issueNumber: number
  readonly actorId: Id
  readonly labelIds: readonly Id[]
}

type IssueStateInput = IssueScope & {
  readonly issueNumber: number
  readonly actorId: Id
}

export type CloseIssueInput = IssueStateInput & { readonly closeReason: IssueCloseReason }
export type ReopenIssueInput = IssueStateInput

export type CreateLabelInput = IssueScope & {
  readonly name: string
  readonly description: string | null
  readonly color: string
}

export type UpdateLabelInput = CreateLabelInput & { readonly labelId: Id }
export type DeleteLabelInput = IssueScope & { readonly labelId: Id; readonly actorId: Id }

export type IssueWriteFailure =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'update_conflict' }
  | { readonly kind: 'label_not_found' }
  | { readonly kind: 'label_name_taken' }
  | { readonly kind: 'file_not_found' }
  | { readonly kind: 'file_not_ready' }
  | { readonly kind: 'invalid_image_file' }
  | { readonly kind: 'duplicate_file_reference' }

export type IssueCommandResult =
  | { readonly kind: 'ok'; readonly issueNumber: number }
  | IssueWriteFailure

export type IssueWriteResult =
  | { readonly kind: 'ok'; readonly issue: IssueDetail }
  | IssueWriteFailure

export type LabelWriteResult =
  | { readonly kind: 'ok'; readonly label: IssueLabel }
  | IssueWriteFailure

export type DeleteLabelResult = { readonly kind: 'ok' } | IssueWriteFailure

export type IssueReads = {
  list: (scope: IssueScope, query: IssueListQuery) => Promise<Paged<IssueSummary>>
  get: (scope: IssueScope, issueNumber: number) => Promise<IssueDetail | null>
  revision: (
    scope: IssueScope,
    issueNumber: number,
    revisionNumber: number,
  ) => Promise<IssueRevision | null>
  history: (scope: IssueScope, issueNumber: number) => Promise<readonly IssueHistoryEntry[] | null>
  labels: (scope: IssueScope) => Promise<readonly IssueLabel[]>
}

export type IssueCommands = {
  create: (input: CreateIssueInput) => Promise<IssueCommandResult>
  update: (input: UpdateIssueInput) => Promise<IssueCommandResult>
  setType: (input: SetIssueTypeInput) => Promise<IssueCommandResult>
  setLabels: (input: SetIssueLabelsInput) => Promise<IssueCommandResult>
  close: (input: CloseIssueInput) => Promise<IssueCommandResult>
  reopen: (input: ReopenIssueInput) => Promise<IssueCommandResult>
}

export type IssueService = IssueReads & {
  create: (input: CreateIssueInput) => Promise<IssueWriteResult>
  update: (input: UpdateIssueInput) => Promise<IssueWriteResult>
  setType: (input: SetIssueTypeInput) => Promise<IssueWriteResult>
  setLabels: (input: SetIssueLabelsInput) => Promise<IssueWriteResult>
  close: (input: CloseIssueInput) => Promise<IssueWriteResult>
  reopen: (input: ReopenIssueInput) => Promise<IssueWriteResult>
  createLabel: (input: CreateLabelInput) => Promise<LabelWriteResult>
  updateLabel: (input: UpdateLabelInput) => Promise<LabelWriteResult>
  deleteLabel: (input: DeleteLabelInput) => Promise<DeleteLabelResult>
}
