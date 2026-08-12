import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTitle } from './title.ts'

const sdk = vi.hoisted(() => ({
  Codex: vi.fn(),
  run: vi.fn(),
}))

vi.mock('@openai/codex-sdk', () => ({ Codex: sdk.Codex }))

beforeEach(() => {
  sdk.Codex.mockReset()
  sdk.run.mockReset()
})

describe('Codex automatic title', () => {
  it('uses the same HTTPS-only Responses provider as conversation turns', async () => {
    sdk.run.mockResolvedValue({ finalResponse: 'Expense approval' })
    sdk.Codex.mockImplementation(() => ({
      startThread: () => ({ run: sdk.run }),
    }))

    await expect(
      generateTitle({
        provider: { model: 'gpt-5.6-sol' },
        worktree: '/tmp/worktree',
        sessions: '/tmp/codex',
        seed: { userText: 'Build approvals', assistantText: 'Who approves?' },
      }),
    ).resolves.toEqual({ kind: 'titled', title: 'Expense approval' })

    expect(sdk.Codex).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          model_provider: 'idea-openai',
          model_providers: {
            'idea-openai': expect.objectContaining({
              base_url: 'https://chatgpt.com/backend-api/codex',
              requires_openai_auth: true,
              supports_websockets: false,
            }),
          },
        },
      }),
    )
  })
})
