import type { Context } from 'hono'
import { failWith, notFound, sendOk } from '../../../../http.ts'
import type {
  DeleteLabelResult,
  IssueWriteResult,
  LabelWriteResult,
} from '../../../../services/issue/types.ts'

type WriteResult = IssueWriteResult | LabelWriteResult | DeleteLabelResult

export const sendIssueResult = (c: Context, result: IssueWriteResult): Response => {
  if (result.kind === 'ok') return sendOk(c, result.issue)
  return sendFailure(c, result)
}

export const sendLabelResult = (c: Context, result: LabelWriteResult): Response => {
  if (result.kind === 'ok') return sendOk(c, result.label)
  return sendFailure(c, result)
}

export const sendDeleteLabelResult = (c: Context, result: DeleteLabelResult): Response => {
  if (result.kind === 'ok') return sendOk(c, { removed: true })
  return sendFailure(c, result)
}

const sendFailure = (c: Context, result: Exclude<WriteResult, { kind: 'ok' }>): Response => {
  if (result.kind === 'not_found') return notFound(c, 'issue or label not found')
  if (result.kind === 'label_not_found') return notFound(c, 'label not found')
  if (result.kind === 'update_conflict') {
    return failWith(c, 409, 'issue_update_conflict', 'issue has changed')
  }
  if (result.kind === 'label_name_taken') {
    return failWith(c, 409, 'label_name_taken', 'a label with that name already exists')
  }
  if (result.kind === 'file_not_found') {
    return failWith(c, 404, 'issue_file_not_found', 'issue file not found')
  }
  if (result.kind === 'file_not_ready') {
    return failWith(c, 409, 'issue_file_not_ready', 'issue file is not ready')
  }
  if (result.kind === 'invalid_image_file') {
    return failWith(c, 400, 'invalid_issue_image', 'issue image must be an image file')
  }
  return failWith(c, 400, 'duplicate_issue_file', 'issue file references must be unique')
}
