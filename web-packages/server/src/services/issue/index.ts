import type { Service } from '../../types.ts'
import { createIssueCommands } from './content.ts'
import { createIssueLabelCommands } from './labels.ts'
import { createIssueMetadataCommands } from './metadata.ts'
import { createIssueReads } from './read.ts'
import { createIssueUpdateCommand } from './update.ts'
import type { IssueCommandResult, IssueScope, IssueService, IssueWriteResult } from './types.ts'

export type {
  CloseIssueInput,
  CreateIssueInput,
  CreateLabelInput,
  DeleteLabelInput,
  IssueListQuery,
  IssueScope,
  IssueService,
  IssueWriteResult,
  ReopenIssueInput,
  SetIssueLabelsInput,
  SetIssueTypeInput,
  UpdateIssueInput,
  UpdateLabelInput,
} from './types.ts'

export const createIssueService: Service<IssueService> = app => {
  const reads = createIssueReads(app)
  const content = createIssueCommands(app)
  const metadata = createIssueMetadataCommands(app)
  const update = createIssueUpdateCommand(app)
  const labels = createIssueLabelCommands(app)
  const completed = async (
    scope: IssueScope,
    result: IssueCommandResult,
  ): Promise<IssueWriteResult> => {
    if (result.kind !== 'ok') return result
    const issue = await reads.get(scope, result.issueNumber)
    if (!issue) throw new Error('issue disappeared after a committed write')
    return { kind: 'ok', issue }
  }

  return {
    ...reads,
    create: async input => completed(input, await content.create(input)),
    update: async input => completed(input, await update.update(input)),
    setType: async input => completed(input, await metadata.setType(input)),
    setLabels: async input => completed(input, await metadata.setLabels(input)),
    close: async input => completed(input, await metadata.close(input)),
    reopen: async input => completed(input, await metadata.reopen(input)),
    createLabel: labels.create,
    updateLabel: labels.update,
    deleteLabel: labels.delete,
  }
}
