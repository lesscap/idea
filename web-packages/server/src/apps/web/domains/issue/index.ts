import type { Controller } from '../../../../types.ts'
import { registerIssueReads } from './read.ts'
import { registerIssueWrites } from './write.ts'

export const IssuesController: Controller = app => {
  registerIssueReads(app)
  registerIssueWrites(app)
}
