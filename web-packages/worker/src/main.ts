import 'dotenv/config'
import { loadWorkerConfig } from './config.ts'
import { runDaemon } from './daemon.ts'

await runDaemon(loadWorkerConfig())
process.exit(0)
