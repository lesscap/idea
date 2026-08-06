import { describe, expect, it } from 'vitest'
import { OSS_OBJECT_PREFIX, OSS_SIGNED_URL_TTL_SECONDS, type OssConfig } from '../config.ts'
import { createStorageService } from './storage.ts'

const config: OssConfig = {
  accessKeyId: 'test-access-key',
  accessKeySecret: 'test-access-secret',
  bucket: 'test-bucket',
  region: 'oss-cn-hangzhou',
  endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
}

type Policy = {
  readonly expiration: string
  readonly conditions: readonly unknown[]
}

describe('OSS upload policy', () => {
  it('binds one object, content type, exact size and a short V4 lifetime', () => {
    const storage = createStorageService(config)
    const key = storage.keyFor(7, 19, 'abc123')
    const before = Date.now()
    const target = storage.signPost(key, 'application/pdf', 4096)
    const encodedPolicy = target.fields.policy
    if (!encodedPolicy) throw new Error('upload target omitted policy')
    const policy = JSON.parse(Buffer.from(encodedPolicy, 'base64').toString()) as Policy
    const lifetime = new Date(policy.expiration).getTime() - before

    expect(key).toBe(`${OSS_OBJECT_PREFIX}/7/19/abc123`)
    expect(target).toMatchObject({
      method: 'POST',
      fields: {
        key,
        'Content-Type': 'application/pdf',
        'x-oss-signature-version': 'OSS4-HMAC-SHA256',
        success_action_status: '204',
      },
    })
    expect(policy.conditions).toEqual(
      expect.arrayContaining([
        { bucket: config.bucket },
        ['eq', '$key', key],
        ['eq', '$content-type', 'application/pdf'],
        ['content-length-range', 4096, 4096],
      ]),
    )
    expect(lifetime).toBeGreaterThan((OSS_SIGNED_URL_TTL_SECONDS - 1) * 1000)
    expect(lifetime).toBeLessThanOrEqual(OSS_SIGNED_URL_TTL_SECONDS * 1000 + 1000)
  })
})

describe('OSS download URLs', () => {
  it('keeps previews inline and makes explicit downloads attachments', async () => {
    const storage = createStorageService(config)
    const inline = new URL(await storage.signGet('idea/files/1/2/file123', '说明.md'))
    const download = new URL(
      await storage.signGet('idea/files/1/2/file123', '说明.md', 'attachment'),
    )

    expect(inline.searchParams.get('response-content-disposition')).toBe(
      "inline; filename*=UTF-8''%E8%AF%B4%E6%98%8E.md",
    )
    expect(download.searchParams.get('response-content-disposition')).toBe(
      "attachment; filename*=UTF-8''%E8%AF%B4%E6%98%8E.md",
    )
  })
})
