import type { Prisma } from '@idea/core'
import type { Attachment } from '@idea/shared'
import type { IssueWriteFailure } from './types.ts'

type Transaction = Prisma.TransactionClient
export type IssueFileReference = {
  readonly fileId: number
  readonly role: 'image' | 'attachment'
  readonly position: number
}

export const revisionFileData = (references: readonly IssueFileReference[]) =>
  references.map(reference => ({ ...reference }))

export const sameIssueFiles = (
  current: readonly IssueFileReference[],
  next: readonly IssueFileReference[],
): boolean =>
  current.length === next.length &&
  current.every((file, index) => {
    const candidate = next[index]
    return (
      candidate !== undefined &&
      file.fileId === candidate.fileId &&
      file.role === candidate.role &&
      file.position === candidate.position
    )
  })

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

const references = (
  files: ReadonlyMap<string, { readonly id: number }>,
  role: IssueFileReference['role'],
  fids: readonly string[],
): readonly IssueFileReference[] =>
  fids.map((fid, position) => ({ fileId: files.get(fid)!.id, role, position }))

export const resolveIssueFiles = async (
  tx: Transaction,
  appId: number,
  imageFids: readonly string[],
  attachmentFids: readonly string[],
): Promise<
  { readonly kind: 'ok'; readonly references: readonly IssueFileReference[] } | IssueWriteFailure
> => {
  const fids = [...imageFids, ...attachmentFids]
  if (new Set(fids).size !== fids.length) return { kind: 'duplicate_file_reference' }
  if (fids.length === 0) return { kind: 'ok', references: [] }

  const rows = await tx.file.findMany({
    where: { appId, fid: { in: fids } },
    select: { id: true, fid: true, contentType: true, status: true },
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
      ...references(byFid, 'image', imageFids),
      ...references(byFid, 'attachment', attachmentFids),
    ],
  }
}
