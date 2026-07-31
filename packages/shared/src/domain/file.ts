export type FileStatus = 'pending' | 'ready'

export type UploadedFile = {
  readonly fid: string
  readonly filename: string
  readonly contentType: string
  readonly size: number
  readonly status: FileStatus
  readonly url: string | null
  readonly createdAt: string
}

export type CreateFileUploadRequest = {
  readonly filename: string
  readonly contentType: string
  readonly size: number
}

export type PostUploadTarget = {
  readonly url: string
  readonly method: 'POST'
  readonly fields: Readonly<Record<string, string>>
}

export type CreateFileUploadResult = {
  readonly file: UploadedFile
  readonly upload: PostUploadTarget
}
