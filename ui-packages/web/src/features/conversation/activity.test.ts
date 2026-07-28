import { describe, expect, it } from 'vitest'
import {
  type ActivityGroup,
  groupActivity,
  isActivityGroup,
  previewOf,
  stripEnv,
  summarise,
  toneOf,
  toolSummary,
  truncateMiddle,
} from './activity'
import type { Bubble } from './transcript'

const thinking = (key: string, text = 'weighing it up'): Bubble => ({ kind: 'thinking', key, text })

const tool = (key: string, name: string, extra: Partial<Bubble & { name: string }> = {}): Bubble =>
  ({ kind: 'tool', key, name, input: {}, running: false, failed: false, ...extra }) as Bubble

const said = (key: string): Bubble => ({ kind: 'agent', key, text: 'here is what I found' })

describe('folding the working-out', () => {
  it('gathers a consecutive run into one group', () => {
    const items = groupActivity([thinking('a'), tool('b', 'Read'), thinking('c')], false)

    expect(items).toHaveLength(1)
    expect(isActivityGroup(items[0]!) && items[0].items).toHaveLength(3)
  })

  // The agent speaking is the boundary: what it did before belongs to that
  // sentence, what comes after belongs to the next one.
  it('is cut by the agent speaking', () => {
    const items = groupActivity(
      [thinking('a'), thinking('b'), said('answer'), thinking('c'), thinking('d')],
      false,
    )

    expect(items.map(i => i.kind)).toEqual(['activity-group', 'agent', 'activity-group'])
  })

  // Wrapping one line costs a summary row and a disclosure control to hide a
  // single line.
  it('leaves a lone step unwrapped', () => {
    const items = groupActivity([thinking('a'), said('answer')], false)

    expect(items.map(i => i.kind)).toEqual(['thinking', 'agent'])
  })

  it('marks only the trailing group live, and only while working', () => {
    const working = groupActivity([thinking('a'), said('x'), thinking('b'), thinking('c')], true)
    const finished = groupActivity([thinking('a'), said('x'), thinking('b'), thinking('c')], false)

    expect(working.filter(i => isActivityGroup(i) && i.live)).toHaveLength(1)
    expect(finished.filter(i => isActivityGroup(i) && i.live)).toHaveLength(0)
  })

  // A single step that is still running does get the group treatment: it is the
  // only place the "running" state can be shown.
  it('wraps even a lone step while it is the live one', () => {
    const items = groupActivity([said('x'), thinking('a')], true)

    expect(items.at(-1)?.kind).toBe('activity-group')
  })
})

describe('what the collapsed row says', () => {
  const group = (items: Bubble[]): ActivityGroup => ({
    kind: 'activity-group',
    key: 'g',
    items: items as ActivityGroup['items'],
    live: false,
  })

  it('counts repeats of the same tool, in the order first seen', () => {
    const { steps, parts } = summarise(
      group([tool('a', 'Read'), tool('b', 'Grep'), tool('c', 'Read')]),
      'thinking',
    )

    expect(steps).toBe(3)
    expect(parts).toEqual(['2 Read', '1 Grep'])
  })

  it('puts thinking last, after what was actually done', () => {
    const { parts } = summarise(group([thinking('a'), tool('b', 'Read')]), 'thinking')

    expect(parts).toEqual(['1 Read', '1 thinking'])
  })

  // Folding may hide detail. It must never hide that something broke.
  it('surfaces failures even though everything else is hidden', () => {
    const { failed } = summarise(
      group([tool('a', 'Bash', { failed: true }), tool('b', 'Read')]),
      'thinking',
    )

    expect(failed).toBe(1)
  })
})

describe('reading a step at a glance', () => {
  // Side-effectful tools should not look like read-only ones — that difference
  // is the whole point of scanning before reading.
  it('separates tools that change something from ones that only look', () => {
    expect(toneOf(tool('a', 'Bash') as never)).toBe('write')
    expect(toneOf(tool('b', 'Read') as never)).toBe('read')
  })

  it('lets failure and running outrank what kind of tool it is', () => {
    expect(toneOf(tool('a', 'Bash', { failed: true }) as never)).toBe('error')
    expect(toneOf(tool('b', 'Bash', { running: true }) as never)).toBe('running')
  })
})

describe('summarising a call', () => {
  it('leads with the command, not the environment in front of it', () => {
    expect(stripEnv('FOO=1 BAR=2 git status')).toBe('git status')
    expect(toolSummary('Bash', { command: 'NODE_ENV=test pnpm vitest' })).toBe('pnpm vitest')
  })

  // Commands sharing a prefix differ at the end. Chopping the tail throws away
  // exactly the part that tells them apart.
  it('elides the middle of a long command rather than its end', () => {
    const long = `pnpm exec ${'x'.repeat(200)} --the-distinguishing-flag`

    expect(truncateMiddle(long)).toContain('--the-distinguishing-flag')
    expect(truncateMiddle(long).length).toBeLessThan(long.length)
  })

  it('says which file, for the tools that take one', () => {
    expect(toolSummary('Read', { file_path: 'src/app.ts' })).toBe('src/app.ts')
    expect(toolSummary('Grep', { pattern: 'TODO', path: 'src' })).toBe('TODO · src')
  })

  // An unknown tool should still say something — a new one should not render as
  // a blank row.
  it('falls back to the first field for a tool it does not know', () => {
    expect(toolSummary('SomethingNew', { target: 'the thing' })).toBe('target: the thing')
  })
})

describe('labelling reasoning', () => {
  // A character count tells you nothing you would act on; the first line is
  // where a turning point shows up.
  it('previews the first line that has anything in it', () => {
    expect(previewOf('\n\n  now I see the problem  \nand then some')).toBe('now I see the problem')
  })

  it('clips a long first line rather than wrapping the row', () => {
    expect(previewOf('x'.repeat(200)).length).toBeLessThanOrEqual(61)
  })
})
