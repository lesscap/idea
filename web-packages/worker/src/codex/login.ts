import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { agentEnv } from '../agent/env.ts'
import { workspaceRoot } from '../identity.ts'
import { repoLayout } from '../worktree.ts'

const require = createRequire(import.meta.url)
const codexBin = require.resolve('@openai/codex/bin/codex.js')
const codexHome = repoLayout(workspaceRoot(), '_scratch').codex
mkdirSync(codexHome, { recursive: true })

const result = spawnSync(process.execPath, [codexBin, 'login'], {
  stdio: 'inherit',
  env: agentEnv({ CODEX_HOME: codexHome }),
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
