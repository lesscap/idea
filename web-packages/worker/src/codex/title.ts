import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProviderConfig, TitleOutcome, TitleSeed } from '../agent/index.ts'
import { buildTitlePrompt, titleOutcome } from '../claude/title.ts'
import { createCodexClient } from './client.ts'

export const generateTitle = async (input: {
  provider: ProviderConfig
  worktree: string
  sessions: string
  seed: TitleSeed
}): Promise<TitleOutcome> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  const worktree = await mkdtemp(join(tmpdir(), 'idea-codex-title-'))
  try {
    const codex = createCodexClient(input.sessions)
    const thread = codex.startThread({
      workingDirectory: worktree,
      skipGitRepoCheck: true,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
      model: input.provider.model,
    })
    const prompt = `You title chat sessions.\n\n${buildTitlePrompt(input.seed)}`
    const result = await thread.run(prompt, { signal: controller.signal })
    return titleOutcome(result.finalResponse)
  } catch (error) {
    return { kind: 'error', reason: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
    await rm(worktree, { recursive: true, force: true })
  }
}
