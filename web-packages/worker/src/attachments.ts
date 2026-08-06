import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import type { Attachment, StoredEvent } from '@idea/shared'
import type { WorkerClient } from './client.ts'

const ATTACHMENTS_DIR = 'attachments'
const MAX_FILENAME = 120

const safeFid = (fid: string): string => fid.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file'

export const safeFilename = (filename: string): string => {
  const cleaned = [...filename]
    .map(character => {
      const code = character.charCodeAt(0)
      return character === '/' || character === '\\' || code < 32 || code === 127 ? '_' : character
    })
    .join('')
    .trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'file'

  const extension = extname(cleaned).slice(0, 20)
  const stem = cleaned.slice(0, extension ? -extension.length : undefined)
  return `${stem.slice(0, Math.max(1, MAX_FILENAME - extension.length))}${extension}`
}

export const attachmentPath = (attachment: Attachment): string =>
  `${ATTACHMENTS_DIR}/${safeFid(attachment.fid)}/${safeFilename(attachment.filename)}`

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  )

const saveResponse = async (response: Response, target: string, expectedSize: number) => {
  const temporary = `${target}.download-${randomUUID()}`
  let actualSize = 0
  const count = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      actualSize += chunk.length
      callback(null, chunk)
    },
  })

  try {
    await pipeline(
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      count,
      createWriteStream(temporary, { flags: 'wx' }),
    )
    if (actualSize !== expectedSize) {
      throw new Error(`downloaded ${actualSize} bytes, expected ${expectedSize}`)
    }
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

const userAttachments = (events: readonly StoredEvent[]): Attachment[] =>
  events.flatMap(({ event }) =>
    event.type === 'user_message' ? [...(event.attachments ?? [])] : [],
  )

export const materializeAttachments = async (
  client: Pick<WorkerClient, 'downloadFile'>,
  worktree: string,
  events: readonly StoredEvent[],
): Promise<void> => {
  const attachments = [...new Map(userAttachments(events).map(file => [file.fid, file])).values()]
  if (attachments.length === 0) return

  const root = join(worktree, ATTACHMENTS_DIR)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, '.gitignore'), '*\n', 'utf8')

  for (const attachment of attachments) {
    const target = join(worktree, attachmentPath(attachment))
    if (await exists(target)) continue

    await mkdir(dirname(target), { recursive: true })
    await saveResponse(await client.downloadFile(attachment.fid), target, attachment.size)
  }
}

export const attachmentPrompt = (attachment: Attachment): string =>
  `- ${attachmentPath(attachment)}`
