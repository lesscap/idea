import type { Attachment, FileStatus, Id, PostUploadTarget } from '@idea/shared'
import { nanoid } from 'nanoid'
import type { Service } from '../types.ts'

export type FileRecord = {
  readonly id: Id
  readonly fid: string
  readonly appId: Id
  readonly uploadedById: Id
  readonly filename: string
  readonly contentType: string
  readonly size: number
  readonly storageKey: string
  readonly status: FileStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export type FileCreate = {
  readonly workspaceId: Id
  readonly appId: Id
  readonly uploadedById: Id
  readonly filename: string
  readonly contentType: string
  readonly size: number
}

export type FileCreateResult =
  | {
      readonly kind: 'ok'
      readonly file: FileRecord
      readonly upload: PostUploadTarget
    }
  | { readonly kind: 'storage_unavailable' }

export type FileConfirmResult =
  | { readonly kind: 'ok'; readonly file: FileRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_uploaded' }
  | { readonly kind: 'size_mismatch' }
  | { readonly kind: 'storage_unavailable' }

export type ResolveAttachmentsResult =
  | { readonly kind: 'ok'; readonly attachments: readonly Attachment[] }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_ready' }

export type FileService = {
  createUpload: (input: FileCreate) => Promise<FileCreateResult>
  confirm: (userId: Id, fid: string) => Promise<FileConfirmResult>
  getForMember: (userId: Id, fid: string) => Promise<FileRecord | null>
  resolveAttachments: (appId: Id, fids: readonly string[]) => Promise<ResolveAttachmentsResult>
  getReadyForWorkspace: (workspaceId: Id, fid: string) => Promise<FileRecord | null>
}

type Row = {
  id: number
  fid: string
  appId: number
  uploadedById: number
  filename: string
  contentType: string
  size: number
  storageKey: string
  status: FileStatus
  createdAt: Date
  updatedAt: Date
}

const toFile = (row: Row): FileRecord => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const reportStorageError = (operation: string, error: unknown): void => {
  globalThis.console.error(`OSS ${operation} failed`, error)
}

export const createFileService: Service<FileService> = app => ({
  createUpload: async input => {
    const storage = app.$storage
    if (!storage) return { kind: 'storage_unavailable' }

    const fid = nanoid(12)
    const storageKey = storage.keyFor(input.workspaceId, input.appId, fid)
    let upload: PostUploadTarget
    try {
      upload = storage.signPost(storageKey, input.contentType, input.size)
    } catch (error) {
      reportStorageError('signPost', error)
      return { kind: 'storage_unavailable' }
    }

    const file = await app.$prisma.file.create({
      data: {
        fid,
        appId: input.appId,
        uploadedById: input.uploadedById,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        storageKey,
      },
    })
    return { kind: 'ok', file: toFile(file), upload }
  },

  confirm: async (userId, fid) => {
    const row = await app.$prisma.file.findFirst({
      where: {
        fid,
        uploadedById: userId,
        app: { workspace: { users: { some: { userId } } } },
      },
    })
    if (!row) return { kind: 'not_found' }
    if (row.status === 'ready') return { kind: 'ok', file: toFile(row) }

    const storage = app.$storage
    if (!storage) return { kind: 'storage_unavailable' }

    let object: { readonly size: number } | null
    try {
      object = await storage.head(row.storageKey)
    } catch (error) {
      reportStorageError('head', error)
      return { kind: 'storage_unavailable' }
    }
    if (!object) return { kind: 'not_uploaded' }
    if (object.size !== row.size) return { kind: 'size_mismatch' }

    return {
      kind: 'ok',
      file: toFile(
        await app.$prisma.file.update({
          where: { id: row.id },
          data: { status: 'ready' },
        }),
      ),
    }
  },

  getForMember: async (userId, fid) => {
    const row = await app.$prisma.file.findFirst({
      where: {
        fid,
        app: { workspace: { users: { some: { userId } } } },
      },
    })
    return row ? toFile(row) : null
  },

  resolveAttachments: async (appId, fids) => {
    const uniqueFids = [...new Set(fids)]
    if (uniqueFids.length === 0) return { kind: 'ok', attachments: [] }

    const rows = await app.$prisma.file.findMany({
      where: { appId, fid: { in: uniqueFids } },
    })
    if (rows.length !== uniqueFids.length) return { kind: 'not_found' }
    if (rows.some(row => row.status !== 'ready')) return { kind: 'not_ready' }

    const byFid = new Map(rows.map(row => [row.fid, row]))
    return {
      kind: 'ok',
      attachments: fids.flatMap(fid => {
        const row = byFid.get(fid)
        return row
          ? [
              {
                fid: row.fid,
                filename: row.filename,
                contentType: row.contentType,
                size: row.size,
              },
            ]
          : []
      }),
    }
  },

  getReadyForWorkspace: async (workspaceId, fid) => {
    const row = await app.$prisma.file.findFirst({
      where: { fid, status: 'ready', app: { workspaceId } },
    })
    return row ? toFile(row) : null
  },
})
