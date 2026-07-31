import type { StoredEvent } from '@idea/shared'
import { describe, expect, it } from 'vitest'
import { asContext, userPrompt } from './session.ts'

const stored = (sequence: number, event: StoredEvent['event']): StoredEvent => ({
  id: sequence + 1,
  sequence,
  createdAt: '2026-07-31T00:00:00.000Z',
  event,
})

describe('Claude conversation context', () => {
  it('includes historical attachment paths and the current message once', () => {
    const previous = stored(0, {
      type: 'user_message',
      text: '先看背景',
      attachments: [
        { fid: 'old123', filename: '背景.pdf', contentType: 'application/pdf', size: 10 },
      ],
    })
    const current = {
      type: 'user_message' as const,
      text: '再看这份',
      attachments: [
        { fid: 'new123', filename: '需求.docx', contentType: 'application/docx', size: 20 },
      ],
    }

    const prompt = asContext([previous], current)

    expect(prompt).toContain('attachments/old123/背景.pdf')
    expect(prompt).toContain('attachments/new123/需求.docx')
    expect(prompt.match(/再看这份/g)).toHaveLength(1)
    expect(userPrompt(current)).not.toContain('先看背景')
  })
})
