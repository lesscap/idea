import type { StoredEvent } from '@idea/shared'
import { oneShot } from './one-shot.ts'
import type { ProviderConfig } from './session.ts'

// Naming a conversation after what it is about.
//
// A conversation is worth finding again, and `#15` is not how anyone looks for
// it. The opening exchange is enough to say what the subject is — the person has
// described what they need and the agent has answered once — so the name is
// settled after that turn and not revisited.
//
// The prompt and the cleanup below are lifted from baton and term-web, which
// arrived at nearly the same text independently. Two things in particular are
// hard-won rather than stylistic, and both live in one-shot.ts: the one-line
// summariser persona (inside the agent harness the model answers NONE
// surprisingly often) and not loading the project's CLAUDE.md (it steers a
// titling ask into prose).

export type TitleSeed = { userText: string; assistantText: string }

export type TitleOutcome = { kind: 'titled'; title: string } | { kind: 'declined' }

// Below this there is nothing to summarise — a greeting, a test ping — and the
// call is not worth making.
const MIN_SEED = 4

// Each side bounded so the prompt stays small. A first message is a requirement
// in prose, which can run long; the subject is always near the start of it.
const CLIP = 1200

const MAX_TITLE = 30

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s)

// The transcript available after the opening turn. It can include follow-up
// input queued while that turn ran; all of it is useful naming context. Several
// agent_message items are one answer arriving in blocks, so they join rather
// than compete; only `item.completed` is read because that is the only frame
// the adapter emits for prose.
export const extractSeed = (events: readonly StoredEvent[]): TitleSeed | null => {
  const userText = events
    .flatMap(({ event }) => (event.type === 'user_message' ? [event.text] : []))
    .join('\n\n')
    .trim()
  const assistantText = events
    .flatMap(({ event }) =>
      event.type === 'item.completed' && event.item.type === 'agent_message'
        ? [event.item.text]
        : [],
    )
    .join('\n\n')
    .trim()

  return `${userText}${assistantText}`.length < MIN_SEED ? null : { userText, assistantText }
}

export const buildTitlePrompt = ({ userText, assistantText }: TitleSeed): string => {
  const exchange = [
    `User: ${clip(userText, CLIP)}`,
    assistantText ? `Assistant: ${clip(assistantText, CLIP)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    'Name the TOPIC of this conversation — what it is ABOUT — as a short title:',
    'a noun phrase like a filename, at most 6 words or about 12 Chinese characters.',
    'Name the subject, do NOT restate the answer or what was asked next.',
    'No sentence, no punctuation at all (including Chinese ，。、；！？), no markdown,',
    'no quotes, and never an opener like "好的"/"收到"/"I\'ll".',
    'Answer in the language the conversation is in.',
    '',
    'Examples (exchange → title):',
    'User describes needing expense claims approved by a manager then finance;',
    'assistant asks how many levels → 报销审批流程',
    'User wants the warehouse notified whenever an order is paid → 订单支付通知仓库',
    '',
    'Only if the exchange below has no real content at all (a greeting or a test',
    'ping) reply with exactly NONE. Otherwise reply with ONLY the title.',
    '',
    exchange,
  ].join('\n')
}

// Models hand back a title wearing whatever the surrounding chat habit is:
// wrapped in quotes, prefixed with "Title:", bulleted, or written as a whole
// sentence. Each replacement below is one of those habits.
export const sanitizeTitle = (raw: string): string =>
  raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/[*_`~#>]/g, '')
    .replace(/["']/g, '')
    .replace(/^\s*(?:title|session|标题)\s*[:：-]\s*/i, '')
    .replace(/^\s*(?:[-*•]|\d+[.)、])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    // When it answers with a sentence anyway, keep the leading clause — that is
    // the noun phrase. CJK punctuation never belongs in a title; ASCII .!?; only
    // when sentence-final, so `1.2` and `file.ts` survive.
    .replace(/(?:[。．！？，、；]|[.!?;](?=\s|$)).*$/s, '')
    .trim()
    .slice(0, MAX_TITLE)
    .replace(/[\s。．，,、；;：:!！?？.]+$/, '')
    .trim()

// The sentinel the prompt asks for when there is nothing to name, and whatever
// punctuation the model wrapped it in.
const isDeclined = (title: string): boolean =>
  title.replace(/[^a-z]/gi, '').toUpperCase() === 'NONE'

export const titleOutcome = (raw: string): TitleOutcome => {
  const title = sanitizeTitle(raw)
  return !title || isDeclined(title) ? { kind: 'declined' } : { kind: 'titled', title }
}

export const generateTitle = async (input: {
  provider: ProviderConfig
  worktree: string
  sessions: string
  seed: TitleSeed
}): Promise<TitleOutcome | { kind: 'error'; reason: string }> => {
  const result = await oneShot({
    provider: input.provider,
    worktree: input.worktree,
    sessions: input.sessions,
    systemPrompt: 'You title chat sessions.',
    prompt: buildTitlePrompt(input.seed),
  })
  return result.kind === 'error' ? result : titleOutcome(result.text)
}
