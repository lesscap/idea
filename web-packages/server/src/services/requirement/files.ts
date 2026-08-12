import type { Prisma } from '@idea/core'
import type { Attachment } from '@idea/shared'
import type { RequirementWriteFailure } from './types.ts'

type Transaction = Prisma.TransactionClient
type RequirementFileRole = 'image' | 'attachment'

type FileReference = {
  readonly fileId: number
  readonly role: RequirementFileRole
  readonly position: number
}

type ResolvedFiles = {
  readonly kind: 'ok'
  readonly references: readonly FileReference[]
}

type FileRow = {
  readonly id: number
  readonly fid: string
  readonly filename: string
  readonly contentType: string
  readonly size: number
  readonly status: 'pending' | 'ready'
}

export const fileSelect = {
  fid: true,
  filename: true,
  contentType: true,
  size: true,
} as const

export const toAttachment = (file: Attachment): Attachment => ({
  fid: file.fid,
  filename: file.filename,
  contentType: file.contentType,
  size: file.size,
})

const duplicateFid = (imageFids: readonly string[], attachmentFids: readonly string[]) => {
  const fids = [...imageFids, ...attachmentFids]
  return new Set(fids).size !== fids.length
}

const referenceRows = (
  files: ReadonlyMap<string, FileRow>,
  role: RequirementFileRole,
  fids: readonly string[],
): readonly FileReference[] =>
  fids.map((fid, position) => ({ fileId: files.get(fid)!.id, role, position }))

export const resolveRequirementFiles = async (
  tx: Transaction,
  appId: number,
  imageFids: readonly string[],
  attachmentFids: readonly string[],
): Promise<ResolvedFiles | RequirementWriteFailure> => {
  if (duplicateFid(imageFids, attachmentFids)) return { kind: 'duplicate_file_reference' }

  const fids = [...imageFids, ...attachmentFids]
  if (fids.length === 0) return { kind: 'ok', references: [] }

  const rows = await tx.file.findMany({
    where: { appId, fid: { in: fids } },
    select: {
      id: true,
      fid: true,
      filename: true,
      contentType: true,
      size: true,
      status: true,
    },
  })
  if (rows.length !== fids.length) return { kind: 'file_not_found' }
  if (rows.some(file => file.status !== 'ready')) return { kind: 'file_not_ready' }

  const byFid = new Map(rows.map(file => [file.fid, file]))
  if (imageFids.some(fid => !byFid.get(fid)?.contentType.startsWith('image/'))) {
    return { kind: 'invalid_image_file' }
  }

  return {
    kind: 'ok',
    references: [
      ...referenceRows(byFid, 'image', imageFids),
      ...referenceRows(byFid, 'attachment', attachmentFids),
    ],
  }
}
