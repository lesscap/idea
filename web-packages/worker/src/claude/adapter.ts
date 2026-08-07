import type { AgentAdapter } from '../agent/index.ts'
import { canResume, runClaude } from './session.ts'
import { generateTitle } from './title.ts'

export const claudeAdapter: AgentAdapter = {
  canResume,
  run: runClaude,
  generateTitle,
}
