import type { CreateFileUploadResult, Id, UploadedFile } from '@idea/shared'
import { post, RequestError } from './request'

export const uploadAppFile = async (appId: Id, file: File): Promise<UploadedFile> => {
  const contentType = file.type || 'application/octet-stream'
  const intent = await post<CreateFileUploadResult>(`/apps/${appId}/files`, {
    filename: file.name,
    contentType,
    size: file.size,
  })

  const form = new FormData()
  for (const [name, value] of Object.entries(intent.upload.fields)) form.append(name, value)
  form.append('file', file)

  const uploaded = await fetch(intent.upload.url, { method: intent.upload.method, body: form })
  if (!uploaded.ok) {
    throw new RequestError('upload_failed', `file upload failed: ${uploaded.status}`)
  }

  return post<UploadedFile>(`/files/${encodeURIComponent(intent.file.fid)}/confirm`)
}
