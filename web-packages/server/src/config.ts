export type Config = {
  readonly port: number
  readonly databaseUrl: string
  readonly authSecret: string
  readonly oss: OssConfig | null
  readonly isProduction: boolean
}

export type OssConfig = {
  readonly accessKeyId: string
  readonly accessKeySecret: string
  readonly bucket: string
  readonly region: string
  readonly endpoint: string
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const OSS_OBJECT_PREFIX = 'idea/files'
export const OSS_SIGNED_URL_TTL_SECONDS = 300
export const OSS_REQUEST_TIMEOUT_MS = 8000

// Reading `env` as a parameter (rather than `process.env` directly) keeps this a
// pure function: tests pass a literal, nothing global is touched.
type Env = Record<string, string | undefined>

// Required settings must be present in production. In development we fall back
// so a fresh clone boots, but a missing secret can never silently default in
// production — it fails at startup instead of at first use.
const required = (env: Env, name: string, devFallback: string, isProduction: boolean): string => {
  const value = env[name]
  if (value) return value
  if (isProduction) throw new Error(`missing required env var: ${name}`)
  return devFallback
}

const loadOssConfig = (env: Env, isProduction: boolean): OssConfig | null => {
  const values = {
    OSS_ACCESS_KEY_ID: env.OSS_ACCESS_KEY_ID?.trim() ?? '',
    OSS_ACCESS_KEY_SECRET: env.OSS_ACCESS_KEY_SECRET?.trim() ?? '',
    OSS_BUCKET: env.OSS_BUCKET?.trim() ?? '',
    OSS_REGION: env.OSS_REGION?.trim() ?? '',
  }
  const entries = Object.entries(values)
  const configured = entries.filter(([, value]) => value !== '')

  if (configured.length === 0 && !isProduction) return null

  const missing = entries.filter(([, value]) => value === '').map(([name]) => name)
  if (missing.length > 0) throw new Error(`incomplete OSS config: missing ${missing.join(', ')}`)

  return {
    accessKeyId: values.OSS_ACCESS_KEY_ID,
    accessKeySecret: values.OSS_ACCESS_KEY_SECRET,
    bucket: values.OSS_BUCKET,
    region: values.OSS_REGION,
    endpoint: env.OSS_ENDPOINT?.trim() || `https://${values.OSS_REGION}.aliyuncs.com`,
  }
}

export const loadConfig = (env: Env = process.env): Config => {
  const isProduction = env.NODE_ENV === 'production'
  return {
    port: Number(env.PORT ?? 3300),
    databaseUrl: required(
      env,
      'DATABASE_URL',
      'postgresql://idea:idea@localhost:5432/idea?schema=public',
      isProduction,
    ),
    // Encrypts the session cookie. The dev fallback is a fixed, obviously-fake
    // value so a fresh clone boots; in production a missing secret stops the
    // process at startup rather than silently issuing forgeable sessions.
    authSecret: required(
      env,
      'AUTH_SECRET',
      '0000000000000000000000000000000000000000000000000000000000000000',
      isProduction,
    ),
    oss: loadOssConfig(env, isProduction),
    isProduction,
  }
}
