import { describe, expect, it } from 'vitest'
import { loadWorkerConfig } from './config.ts'

// A worker that silently registers under the wrong name or points at the wrong
// server is hard to spot in a fleet, so the fallbacks are worth pinning down.
const REQUIRED = { IDEA_ENROLMENT_TOKEN: 'tok', IDEA_PROVIDER: 'glm' }

describe('loadWorkerConfig', () => {
  it('falls back to the hostname when no name is configured', () => {
    expect(loadWorkerConfig({ ...REQUIRED }, 'build-01').name).toBe('build-01')
  })

  it('treats an empty name as unset rather than as a valid handle', () => {
    expect(loadWorkerConfig({ ...REQUIRED, WORKER_NAME: '' }, 'build-01').name).toBe('build-01')
  })

  it('prefers the configured server over the local default', () => {
    expect(
      loadWorkerConfig({ ...REQUIRED, IDEA_SERVER: 'https://idea.internal' }, 'h').server,
    ).toBe('https://idea.internal')
  })

  // Capabilities decide what work the server routes here, so a parsing slip is
  // silent: the worker connects normally and simply never receives anything.
})

// Both would otherwise register successfully and fail on the first turn, which
// is a much worse place to discover a missing setting.
describe('what a worker refuses to start without', () => {
  it('needs an enrolment token, because it cannot name its own workspace', () => {
    expect(() => loadWorkerConfig({ IDEA_PROVIDER: 'glm' }, 'h')).toThrow(/ENROLMENT_TOKEN/)
  })

  it('needs a provider, because it cannot guess which backend it runs', () => {
    expect(() => loadWorkerConfig({ IDEA_ENROLMENT_TOKEN: 'tok' }, 'h')).toThrow(/PROVIDER/)
  })
})
