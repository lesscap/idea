import type { UploadedFile } from '@idea/shared'
import { get } from '../../lib/request'

export type FileDescriptor = Pick<UploadedFile, 'fid' | 'filename'>

export const fileResourceRef = (file: FileDescriptor): string =>
  `files/${file.fid}/${file.filename || 'file'}`

export const fileUrl = (fid: string): string => `/api/web/files/${encodeURIComponent(fid)}`

export const fileDownloadUrl = (fid: string): string => `${fileUrl(fid)}/download`

export const getFileMeta = (fid: string): Promise<UploadedFile> =>
  get<UploadedFile>(`/files/${encodeURIComponent(fid)}/meta`)

export const getFileText = (fid: string): Promise<string> =>
  get<string>(`/files/${encodeURIComponent(fid)}/text`)
