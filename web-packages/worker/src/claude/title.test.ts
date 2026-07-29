import type { ConversationEvent, StoredEvent } from '@idea/shared'
import { describe, expect, it } from 'vitest'
import { extractSeed, sanitizeTitle, titleOutcome } from './title.ts'

// What is pinned here is the gap between what a model hands back and what can go
// in a sidebar. Asking for "only the title" gets a title wearing whatever habit
// the surrounding chat had — quoted, labelled, bulleted, or written out as a
// sentence — and every one of those reaches the interface verbatim if it is not
// stripped here.
describe('cleaning up what the model hands back', () => {
  it.each([
    ['「已加引号」', '"报销审批流程"', '报销审批流程'],
    ['标签前缀', 'Title: 订单支付通知仓库', '订单支付通知仓库'],
    ['中文标签前缀', '标题：报销审批流程', '报销审批流程'],
    ['列表符号', '- 报销审批流程', '报销审批流程'],
    ['markdown 强调', '**报销审批流程**', '报销审批流程'],
  ])('strips %s', (_habit, raw, expected) => {
    expect(sanitizeTitle(raw)).toBe(expected)
  })

  // Folding, not guessing where to break. What stops a multi-line answer from
  // filling the sidebar is the length cap below, and before that the prompt.
  it('folds onto one line', () => {
    expect(sanitizeTitle('报销审批流程\n还需要确认层级')).toBe('报销审批流程 还需要确认层级')
  })

  // A sentence is the most common miss: the model explains instead of naming.
  // The leading clause is the noun phrase, so that is what survives.
  it('keeps only the leading clause of a sentence', () => {
    expect(sanitizeTitle('报销审批流程，需要分成两级审批')).toBe('报销审批流程')
  })

  // The same rule must not fire mid-token, or every filename and version number
  // in a title loses its tail.
  it('does not cut at a dot inside a word', () => {
    expect(sanitizeTitle('config.yaml 结构调整')).toBe('config.yaml 结构调整')
  })

  it('caps the length so a runaway answer cannot fill the sidebar', () => {
    expect(sanitizeTitle('对'.repeat(50))).toHaveLength(30)
  })
})

describe('deciding whether there is a title at all', () => {
  // The prompt asks for this sentinel when the exchange is too thin to name.
  // Left unread it would become a conversation literally called "NONE".
  it.each(['NONE', 'NONE.', '"NONE"', 'none'])('treats %s as no title', raw => {
    expect(titleOutcome(raw)).toEqual({ kind: 'declined' })
  })

  it('declines when nothing survives the cleanup', () => {
    expect(titleOutcome('***')).toEqual({ kind: 'declined' })
  })

  it('takes a real answer', () => {
    expect(titleOutcome('报销审批流程')).toEqual({ kind: 'titled', title: '报销审批流程' })
  })
})

const stored = (event: ConversationEvent, sequence: number): StoredEvent => ({
  id: sequence + 1,
  sequence,
  event,
  createdAt: '',
})

const said = (text: string, sequence: number) => stored({ type: 'user_message', text }, sequence)

const answered = (text: string, sequence: number) =>
  stored(
    {
      type: 'item.completed',
      item: { id: `m${sequence}`, status: 'completed', type: 'agent_message', text },
    },
    sequence,
  )

describe('what gets summarised', () => {
  it('pairs what was asked with what came back', () => {
    expect(extractSeed([said('我想做一个报销审批系统', 0), answered('需要几级审批？', 1)])).toEqual(
      {
        userText: '我想做一个报销审批系统',
        assistantText: '需要几级审批？',
      },
    )
  })

  // One answer arriving as several blocks is still one answer.
  it('joins an answer that came in blocks', () => {
    const seed = extractSeed([said('报销系统', 0), answered('第一段', 1), answered('第二段', 2)])

    expect(seed?.assistantText).toBe('第一段\n\n第二段')
  })

  // A greeting is not worth a model call, and whatever it produced would be
  // worse than the id it replaces.
  it('declines to spend a call on a conversation with nothing in it', () => {
    expect(extractSeed([said('hi', 0)])).toBeNull()
    expect(extractSeed([])).toBeNull()
  })

  // Tool calls are not prose. Reading them as the answer would title the
  // conversation after the agent's plumbing.
  it('ignores everything that is not the agent speaking', () => {
    const seed = extractSeed([
      said('我想做一个报销审批系统', 0),
      stored({ type: 'turn.started' }, 1),
      stored(
        {
          type: 'item.completed',
          item: { id: 't1', status: 'completed', type: 'tool_call', name: 'Read', input: {} },
        },
        2,
      ),
    ])

    expect(seed?.assistantText).toBe('')
  })
})
