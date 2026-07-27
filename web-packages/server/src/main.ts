import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createContext } from './context.ts'

const config = loadConfig()
const [services, dispose] = createContext(config)
const server = serve({ fetch: createApp(services).fetch, port: config.port })

console.log(`idea server listening on :${config.port}`)

const shutdown = async () => {
  server.close()
  await dispose()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
