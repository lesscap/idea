export type Config = {
  readonly port: number
  readonly databaseUrl: string
  readonly isProduction: boolean
}

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
    isProduction,
  }
}
