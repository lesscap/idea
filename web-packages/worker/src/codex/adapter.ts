import type { AgentAdapter } from '../agent/index.ts'
import { canResume, runCodex } from './session.ts'
import { generateTitle } from './title.ts'

export const codexAdapter: AgentAdapter = {
  canResume,
  run: runCodex,
  generateTitle,
}
