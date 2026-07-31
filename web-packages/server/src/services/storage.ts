import type { PostUploadTarget } from '@idea/shared'
import OSS from 'ali-oss'
import {
  OSS_OBJECT_PREFIX,
  OSS_REQUEST_TIMEOUT_MS,
  OSS_SIGNED_URL_TTL_SECONDS,
  type OssConfig,
} from '../config.ts'

export type StorageService = {
  keyFor: (workspaceId: number, appId: number, fid: string) => string
  signPost: (key: string, contentType: string, size: number) => PostUploadTarget
  head: (key: string) => Promise<{ readonly size: number } | null>
  signGet: (key: string, filename: string) => Promise<string>
}

type OssV4Client = OSS & {
  signPostObjectPolicyV4: (policy: object, date: Date) => string
}

const formatOssDate = (date: Date): string => date.toISOString().replace(/[:-]|\.\d{3}/g, '')

const standardRegion = (region: string): string => region.replace(/^oss-/, '')

const encodedFilename = (filename: string): string =>
  encodeURIComponent(filename).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const errorProperty = (error: unknown, name: string): unknown =>
  typeof error === 'object' && error !== null && name in error
    ? (error as Record<string, unknown>)[name]
    : undefined

const isMissingObject = (error: unknown): boolean =>
  errorProperty(error, 'code') === 'NoSuchKey' || errorProperty(error, 'status') === 404

const contentLength = (headers: object): number => {
  const value =
    'content-length' in headers ? (headers as Record<string, unknown>)['content-length'] : undefined
  const size = Number(value)
  if (!Number.isInteger(size) || size < 0) throw new Error('OSS HEAD omitted content-length')
  return size
}

export const createStorageService = (config: OssConfig): StorageService => {
  const client = new OSS({
    region: config.region,
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true,
    authorizationV4: true,
    timeout: OSS_REQUEST_TIMEOUT_MS,
  }) as OssV4Client

  return {
    keyFor: (workspaceId, appId, fid) => `${OSS_OBJECT_PREFIX}/${workspaceId}/${appId}/${fid}`,

    signPost: (key, contentType, size) => {
      const now = new Date()
      const date = formatOssDate(now)
      const credential = `${config.accessKeyId}/${date.slice(0, 8)}/${standardRegion(config.region)}/oss/aliyun_v4_request`
      const policy = {
        expiration: new Date(now.getTime() + OSS_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        conditions: [
          { bucket: config.bucket },
          { 'x-oss-credential': credential },
          { 'x-oss-date': date },
          { 'x-oss-signature-version': 'OSS4-HMAC-SHA256' },
          ['eq', '$key', key],
          ['eq', '$content-type', contentType],
          ['eq', '$success_action_status', '204'],
          ['content-length-range', size, size],
        ],
      }
      const objectUrl = new URL(client.generateObjectUrl(key))
      objectUrl.pathname = '/'
      objectUrl.search = ''

      return {
        url: objectUrl.toString(),
        method: 'POST',
        fields: {
          key,
          policy: Buffer.from(JSON.stringify(policy), 'utf8').toString('base64'),
          'x-oss-date': date,
          'x-oss-credential': credential,
          'x-oss-signature-version': 'OSS4-HMAC-SHA256',
          'x-oss-signature': client.signPostObjectPolicyV4(policy, now),
          'Content-Type': contentType,
          success_action_status: '204',
        },
      }
    },

    head: async key => {
      try {
        const result = await client.head(key, { timeout: OSS_REQUEST_TIMEOUT_MS })
        return { size: contentLength(result.res.headers) }
      } catch (error) {
        if (isMissingObject(error)) return null
        throw error
      }
    },

    signGet: (key, filename) =>
      client.signatureUrlV4(
        'GET',
        OSS_SIGNED_URL_TTL_SECONDS,
        {
          queries: {
            'response-content-disposition': `inline; filename*=UTF-8''${encodedFilename(filename)}`,
            'response-cache-control': 'private, no-store',
          },
        },
        key,
      ),
  }
}
