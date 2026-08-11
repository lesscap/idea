import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../config.ts'
import { createContext } from '../../context.ts'

const media = [
  {
    fid: 'demo-req-flow',
    filename: '请假申请状态流转.svg',
    contentType: 'image/svg+xml',
    asset: './assets/leave-request-flow.svg',
    requirementNumber: 25,
    role: 'image' as const,
  },
  {
    fid: 'demo-req-attachment',
    filename: '附件管理验收说明.md',
    contentType: 'text/markdown',
    asset: './assets/attachment-acceptance.md',
    requirementNumber: 26,
    role: 'attachment' as const,
  },
]

const config = loadConfig()
if (config.isProduction || /prod/i.test(config.databaseUrl)) {
  throw new Error('refusing to seed requirement media into a production database')
}
if (!config.oss) throw new Error('OSS configuration is required to seed requirement media')

const [app, dispose] = createContext(config)

const upload = async (
  target: ReturnType<NonNullable<typeof app.$storage>['signPost']>,
  content: Uint8Array,
  filename: string,
  contentType: string,
) => {
  const form = new FormData()
  Object.entries(target.fields).forEach(([name, value]) => {
    form.append(name, value)
  })
  form.append('file', new Blob([content], { type: contentType }), filename)
  const response = await fetch(target.url, { method: target.method, body: form })
  if (!response.ok) throw new Error(`OSS upload failed with status ${response.status}`)
}

try {
  const context = await app.$prisma.app.findFirst({
    where: { slug: 'leave-request', workspace: { name: '演示空间' } },
    select: { id: true, workspaceId: true, createdById: true },
  })
  if (!context) throw new Error('run the demo and requirement seeds before requirement media')

  for (const item of media) {
    const bytes = new Uint8Array(
      await readFile(fileURLToPath(new URL(item.asset, import.meta.url))),
    )
    const storage = app.$storage
    if (!storage) throw new Error('OSS storage became unavailable')
    const storageKey = storage.keyFor(context.workspaceId, context.id, item.fid)
    const existing = await app.$prisma.file.findUnique({ where: { fid: item.fid } })
    if (existing && (existing.appId !== context.id || existing.storageKey !== storageKey)) {
      throw new Error(`demo file fid ${item.fid} is already used by another object`)
    }
    const file =
      existing ??
      (await app.$prisma.file.create({
        data: {
          fid: item.fid,
          appId: context.id,
          uploadedById: context.createdById,
          filename: item.filename,
          contentType: item.contentType,
          size: bytes.byteLength,
          storageKey,
        },
      }))

    if (file.status !== 'ready') {
      await upload(
        storage.signPost(storageKey, item.contentType, bytes.byteLength),
        bytes,
        item.filename,
        item.contentType,
      )
      const confirmed = await app.$file.confirm(context.createdById, item.fid)
      if (confirmed.kind !== 'ok')
        throw new Error(`could not confirm ${item.fid}: ${confirmed.kind}`)
    }

    const requirement = await app.$prisma.requirement.findUnique({
      where: { appId_number: { appId: context.id, number: item.requirementNumber } },
      select: { id: true, draft: { select: { requirementId: true } } },
    })
    if (!requirement?.draft) throw new Error(`R-${item.requirementNumber} demo draft is missing`)
    await app.$prisma.requirementDraftFile.upsert({
      where: { requirementId_fileId: { requirementId: requirement.id, fileId: file.id } },
      create: {
        requirementId: requirement.id,
        fileId: file.id,
        role: item.role,
        position: 0,
      },
      update: { role: item.role, position: 0 },
    })
    console.log(`  linked ${item.filename} to R-${item.requirementNumber}`)
  }
} finally {
  await dispose()
}
