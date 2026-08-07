import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Attachment, StoredEvent } from '@idea/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentPath, materializeAttachments } from './attachments.ts'

const roots: string[] = []

const worktree = async () => {
  const root = await mkdtemp(join(tmpdir(), 'idea-attachments-'))
  roots.push(root)
  return root
}

const events = (attachment: Attachment): StoredEvent[] => [
  {
    id: 1,
    sequence: 0,
    createdAt: '2026-07-31T00:00:00.000Z',
    event: { type: 'user_message', text: '', attachments: [attachment] },
  },
]

const clientWith = (body: string) => {
  const downloadFile = vi.fn(async () => new Response(body))
  return { client: { downloadFile }, downloadFile }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('materializing attachments', () => {
  it('keeps an unsafe filename inside the worktree and reuses the local copy', async () => {
    const root = await worktree()
    const attachment = {
      fid: 'file123',
      filename: '../../brief.txt',
      contentType: 'text/plain',
      size: 5,
    }
    const { client, downloadFile } = clientWith('brief')

    await materializeAttachments(client, root, events(attachment))
    await materializeAttachments(client, root, events(attachment))

    const relative = attachmentPath(attachment)
    expect(relative).toMatch(/^attachments\/file123\//)
    expect(await readFile(join(root, relative), 'utf8')).toBe('brief')
    expect(downloadFile).toHaveBeenCalledTimes(1)
  })

  it('does not publish a truncated download', async () => {
    const root = await worktree()
    const attachment = {
      fid: 'file123',
      filename: 'brief.txt',
      contentType: 'text/plain',
      size: 99,
    }
    const { client } = clientWith('brief')
    const target = join(root, attachmentPath(attachment))

    await expect(materializeAttachments(client, root, events(attachment))).rejects.toThrow(
      /expected 99/,
    )
    await expect(access(target)).rejects.toThrow()
  })
})
