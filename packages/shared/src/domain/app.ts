import type { Id } from '../ids.ts'

// draft   — being described, not yet real software
// active  — in use
// archived — retired but kept; archiving is reversible, which is why it needs
//            no special permission
export type AppStatus = 'draft' | 'active' | 'archived'

export type App = {
  readonly id: Id
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly status: AppStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export type ConversationSummary = {
  readonly cid: string
  readonly title: string | null
  readonly lastActiveAt: string
}
