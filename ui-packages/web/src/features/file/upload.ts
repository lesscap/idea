import type { CreateFileUploadResult, UploadedFile } from '@idea/shared'
import { post, RequestError } from '../../lib/request'
import { filesPath } from '../conversation/api'
import type { ConversationScope } from '../conversation/scope'

export const uploadConversationFile = async (
  scope: ConversationScope,
  file: File,
): Promise<UploadedFile> => {
  const contentType = file.type || 'application/octet-stream'
  const intent = await post<CreateFileUploadResult>(filesPath(scope), {
    filename: file.name,
    contentType,
    size: file.size,
  })

  const form = new FormData()
  Object.entries(intent.upload.fields).forEach(([name, value]) => {
    form.append(name, value)
  })
  form.append('file', file)

  const uploaded = await fetch(intent.upload.url, { method: intent.upload.method, body: form })
  if (!uploaded.ok) {
    throw new RequestError('upload_failed', `file upload failed: ${uploaded.status}`)
  }

  return post<UploadedFile>(`/files/${encodeURIComponent(intent.file.fid)}/confirm`)
}
