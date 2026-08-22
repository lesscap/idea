import type { Id } from '../ids.ts'
import type { Attachment } from './conversation-event.ts'

export type IssueState = 'open' | 'closed'
export type IssueCloseReason = 'completed' | 'not_planned'
export type IssueType = 'bug' | 'feature' | 'task'

export type IssueActor = {
  readonly id: Id
  readonly name: string
}

export type IssueLabel = {
  readonly id: Id
  readonly name: string
  readonly description: string | null
  readonly color: string
}

export type IssueContent = {
  readonly title: string
  readonly body: string
  readonly images: readonly Attachment[]
  readonly attachments: readonly Attachment[]
}

export type IssueSummary = {
  readonly id: Id
  readonly number: number
  readonly state: IssueState
  readonly closeReason: IssueCloseReason | null
  readonly type: IssueType | null
  readonly title: string
  readonly labels: readonly IssueLabel[]
  readonly createdBy: IssueActor
  readonly createdAt: string
  readonly updatedAt: string
}

export type IssueDetail = IssueContent & {
  readonly id: Id
  readonly number: number
  readonly state: IssueState
  readonly closeReason: IssueCloseReason | null
  readonly type: IssueType | null
  readonly labels: readonly IssueLabel[]
  readonly revisionNumber: number
  readonly createdBy: IssueActor
  readonly updatedBy: IssueActor
  readonly closedBy: IssueActor | null
  readonly closedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type IssueRevisionSummary = {
  readonly kind: 'revision'
  readonly id: Id
  readonly number: number
  readonly editedBy: IssueActor
  readonly createdAt: string
}

export type IssueRevision = IssueContent & IssueRevisionSummary

type IssueActivityBase = {
  readonly id: Id
  readonly actor: IssueActor
  readonly createdAt: string
}

export type IssueActivity =
  | (IssueActivityBase & {
      readonly kind: 'state_changed'
      readonly fromState: IssueState
      readonly toState: IssueState
      readonly closeReason: IssueCloseReason | null
    })
  | (IssueActivityBase & {
      readonly kind: 'type_changed'
      readonly fromType: IssueType | null
      readonly toType: IssueType | null
    })
  | (IssueActivityBase & {
      readonly kind: 'label_added' | 'label_removed'
      readonly labelId: Id | null
      readonly labelName: string
      readonly labelColor: string
    })

export type IssueHistoryEntry = IssueRevisionSummary | IssueActivity
