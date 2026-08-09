type Env = Record<string, string | undefined>

export const requireDemoDatabaseUrl = (env: Env = process.env): string => {
  if (env.NODE_ENV === 'production') {
    throw new Error('refusing to run demo seed in production')
  }

  const url = env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  // NODE_ENV is not enough protection when someone points a development shell
  // at a production database by mistake.
  if (/prod/i.test(url)) {
    throw new Error(`refusing to run: DATABASE_URL looks like production (${url.split('@').pop()})`)
  }
  return url
}
