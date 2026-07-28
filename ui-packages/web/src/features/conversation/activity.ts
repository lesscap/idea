import type { Bubble } from './transcript'

// Folding the agent's working-out so the transcript reads answer-first.
//
// A turn produces two kinds of thing: what the agent SAYS, and what it DID to
// get there. Drawn flat they compete, and the reasoning — which is long and
// arrives first — buries the answer. So consecutive process items collapse into
// one row that can be opened when someone wants to see it.
//
// baton and term-web arrived at the same algorithm independently
// (`session-detail/group-items.ts`, `chat-window/chat-activity-group.tsx`), which
// is the best evidence available that it is the right one.

export type ProcessBubble = Extract<Bubble, { kind: 'thinking' | 'tool' }>

export type ActivityGroup = {
  kind: 'activity-group'
  key: string
  items: ProcessBubble[]
  // True only for the trailing group of a turn still in flight. A live group
  // opens by default — you are watching work happen — while a finished one
  // collapses to its summary.
  live: boolean
}

export type StreamItem = Bubble | ActivityGroup

const isProcess = (bubble: Bubble): bubble is ProcessBubble =>
  bubble.kind === 'thinking' || bubble.kind === 'tool'

export const isActivityGroup = (item: StreamItem): item is ActivityGroup =>
  item.kind === 'activity-group'

export const groupActivity = (bubbles: readonly Bubble[], working: boolean): StreamItem[] => {
  const out: StreamItem[] = []
  let buffer: ProcessBubble[] = []

  const flush = (live: boolean) => {
    if (buffer.length === 0) return
    // One item keeps its plain form. Wrapping it costs a summary row and a
    // disclosure control to hide a single line — more chrome than it saves.
    if (buffer.length === 1 && !live && buffer[0]) out.push(buffer[0])
    else out.push({ kind: 'activity-group', key: `group:${buffer[0]?.key}`, items: buffer, live })
    buffer = []
  }

  for (const bubble of bubbles) {
    if (isProcess(bubble)) {
      buffer.push(bubble)
      continue
    }
    // The agent speaking is the natural boundary: whatever it did before saying
    // this belongs to that sentence, and whatever comes after belongs to the
    // next one.
    flush(false)
    out.push(bubble)
  }
  flush(working)

  return out
}

export type GroupSummary = {
  steps: number
  // Per-kind counts in first-seen order, reading as "2 Read · 1 thinking".
  parts: string[]
  failed: number
}

export const summarise = (group: ActivityGroup, thinkingLabel: string): GroupSummary => {
  const counts = new Map<string, number>()
  for (const item of group.items) {
    const label = item.kind === 'thinking' ? thinkingLabel : item.name
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  // Thinking last: the tools say what happened, and reasoning is the connective
  // tissue between them.
  const thinking = counts.get(thinkingLabel)
  counts.delete(thinkingLabel)
  const parts = [...counts.entries()].map(([name, n]) => `${n} ${name}`)
  if (thinking !== undefined) parts.push(`${thinking} ${thinkingLabel}`)

  return {
    steps: group.items.length,
    parts,
    // Surfaced on the collapsed row on purpose: folding may hide detail, but it
    // must never hide that something failed.
    failed: group.items.filter(item => item.kind === 'tool' && item.failed).length,
  }
}

// What each step looks like at a glance, before reading any of it: which ones
// changed something, which is running, which broke.
export type NodeTone = 'running' | 'error' | 'write' | 'read' | 'thinking'

// Tools that change something, as opposed to ones that only look.
const WRITES = new Set(['Bash', 'Edit', 'Write', 'NotebookEdit'])

export const toneOf = (item: ProcessBubble): NodeTone => {
  if (item.kind === 'thinking') return 'thinking'
  if (item.failed) return 'error'
  if (item.running) return 'running'
  return WRITES.has(item.name) ? 'write' : 'read'
}

// The first line of the reasoning, which is where a turning point shows up
// ("now I see the problem…"). A character count — which is what this replaced —
// tells you nothing you would act on.
export const previewOf = (text: string, max = 60): string => {
  const line =
    text
      .split('\n')
      .find(l => l.trim() !== '')
      ?.trim() ?? ''
  return line.length > max ? `${line.slice(0, max)}…` : line
}

const truncate = (s: string, max = 80) => (s.length > max ? `${s.slice(0, max)}…` : s)

// Leading KEY=VALUE assignments carry no scent — the same variables repeat on
// every call — so the verb should lead.
export const stripEnv = (command: string): string => command.replace(/^(?:\s*\w+=\S+\s+)+/, '')

// Commands sharing a prefix differ at the END, so keep both ends and elide the
// middle. Chopping the tail throws away the part that distinguishes them.
export const truncateMiddle = (s: string, max = 120): string =>
  s.length > max ? `${s.slice(0, Math.ceil(max * 0.6))} … ${s.slice(-Math.floor(max * 0.3))}` : s

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// One readable line per tool call, instead of a blob of JSON. The full input is
// still there when the row is opened.
export const toolSummary = (name: string, input: unknown): string => {
  if (!isRecord(input)) return typeof input === 'string' ? truncate(input) : ''

  if (name === 'Bash' && typeof input.command === 'string')
    return truncateMiddle(stripEnv(input.command))
  if (typeof input.file_path === 'string') return input.file_path
  if (name === 'Grep' && typeof input.pattern === 'string')
    return typeof input.path === 'string' ? `${input.pattern} · ${input.path}` : input.pattern
  if (typeof input.pattern === 'string') return input.pattern

  const [first] = Object.entries(input)
  if (!first) return ''
  const [key, value] = first
  return truncate(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
}
