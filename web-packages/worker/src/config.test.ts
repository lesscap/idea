import { describe, expect, it } from 'vitest'
import { loadWorkerConfig } from './config.ts'

// A worker that silently registers under the wrong name or points at the wrong
// server is hard to spot in a fleet, so the fallbacks are worth pinning down.
describe('loadWorkerConfig', () => {
  it('falls back to the hostname when no name is configured', () => {
    expect(loadWorkerConfig({}, 'build-01').name).toBe('build-01')
  })

  it('treats an empty name as unset rather than as a valid handle', () => {
    expect(loadWorkerConfig({ WORKER_NAME: '' }, 'build-01').name).toBe('build-01')
  })

  it('prefers the configured server over the local default', () => {
    expect(loadWorkerConfig({ IDEA_SERVER: 'https://idea.internal' }, 'h').server).toBe(
      'https://idea.internal',
    )
  })

  // Capabilities decide what work the server routes here, so a parsing slip is
  // silent: the worker connects normally and simply never receives anything.
  it('parses capabilities, tolerating whitespace and trailing separators', () => {
    const config = loadWorkerConfig({ WORKER_CAPABILITIES: ' a , b ,,c, ' }, 'h')
    expect(config.capabilities).toEqual(['a', 'b', 'c'])
  })

  it('yields no capabilities when unset, rather than one empty-string capability', () => {
    expect(loadWorkerConfig({}, 'h').capabilities).toEqual([])
  })
})
