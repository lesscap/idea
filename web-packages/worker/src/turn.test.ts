import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerClient } from './client.ts'
import { runTurn } from './turn.ts'

const mocked = vi.hoisted(() => ({
  run: vi.fn(),
  generateTitle: vi.fn(),
}))

vi.mock('./agent/index.ts', () => ({
  agentFor: () => ({
    canResume: () => false,
    run: mocked.run,
    generateTitle: mocked.generateTitle,
  }),
}))

vi.mock('./attachments.ts', () => ({
  attachmentPath: () => 'attachment',
  materializeAttachments: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./worktree.ts', () => ({
  ensureRepo: vi.fn(),
  ensureWorktree: () => '/tmp/idea-turn-test',
  repoLayout: () => ({
    sessions: '/tmp/idea-turn-test/sessions',
    codex: '/tmp/idea-turn-test/codex',
  }),
}))

const claimed = { id: 8, conversationId: 9, userEventSequence: 4, attempt: 1 }
const conversation = {
  id: 9,
  cid: 'conversation-9',
  appId: 1,
  providerId: 2,
  workerId: 3,
  providerSessionId: null,
  model: null,
  effort: null,
  title: 'Named',
}
const provider = { kind: 'claude', config: { model: 'glm-5.2' } }

const client = (abortRequested = false) => {
  const emit = vi.fn().mockResolvedValue(undefined)
  const finish = vi.fn().mockResolvedValue(undefined)
  const setTitle = vi.fn().mockResolvedValue(true)
  const value = {
    heartbeat: vi.fn().mockResolvedValue({ renewed: true, abortRequested }),
    emit,
    finish,
    setTitle,
    events: vi.fn().mockResolvedValue([
      {
        id: 1,
        sequence: 4,
        createdAt: '2026-08-12T00:00:00.000Z',
        event: { type: 'user_message', text: 'keep working' },
      },
    ]),
  } as unknown as WorkerClient
  return { value, emit, finish, setTitle }
}

beforeEach(() => {
  mocked.run.mockReset()
  mocked.generateTitle.mockReset()
})

describe('aborting a turn', () => {
  it('records an interruption when the agent stream ends cleanly after cancellation', async () => {
    let running: () => void = () => undefined
    const started = new Promise<void>(resolve => {
      running = resolve
    })
    mocked.run.mockImplementation(({ signal }: { signal: AbortSignal }) => ({
      async *[Symbol.asyncIterator]() {
        running()
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve()))
      },
    }))
    const worker = client()
    const controller = new AbortController()

    const turn = runTurn(worker.value, '/tmp', claimed, conversation, provider, controller, vi.fn())
    await started
    controller.abort()
    await turn

    expect(worker.emit).toHaveBeenCalledWith(
      claimed.id,
      expect.objectContaining({ type: 'turn.aborted', reason: 'interrupted' }),
    )
    expect(worker.finish).toHaveBeenCalledWith(claimed.id, 'aborted')
    expect(worker.finish).not.toHaveBeenCalledWith(claimed.id, 'completed')
  })

  it('honours an abort request found by the first heartbeat', async () => {
    mocked.run.mockImplementation(() => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'turn.completed' }
      },
    }))
    const worker = client(true)

    await runTurn(
      worker.value,
      '/tmp',
      claimed,
      conversation,
      provider,
      new AbortController(),
      vi.fn(),
    )

    expect(mocked.run).not.toHaveBeenCalled()
    expect(worker.finish).toHaveBeenCalledWith(claimed.id, 'aborted')
  })
})

describe('lease renewal', () => {
  it('waits for each heartbeat before scheduling another and stops before finish', async () => {
    vi.useFakeTimers()
    try {
      let releaseAgent: () => void = () => undefined
      const agentDone = new Promise<void>(resolve => {
        releaseAgent = resolve
      })
      let agentStarted: () => void = () => undefined
      const started = new Promise<void>(resolve => {
        agentStarted = resolve
      })
      mocked.run.mockImplementation(() => ({
        async *[Symbol.asyncIterator]() {
          agentStarted()
          await agentDone
          yield { type: 'turn.completed' }
        },
      }))

      let releaseHeartbeat: () => void = () => undefined
      const delayedHeartbeat = new Promise<void>(resolve => {
        releaseHeartbeat = resolve
      })
      const worker = client()
      vi.mocked(worker.value.heartbeat)
        .mockResolvedValueOnce({ renewed: true, abortRequested: false })
        .mockImplementationOnce(async () => {
          await delayedHeartbeat
          return { renewed: true, abortRequested: false }
        })
        .mockResolvedValue({ renewed: true, abortRequested: false })

      const turn = runTurn(
        worker.value,
        '/tmp',
        claimed,
        conversation,
        provider,
        new AbortController(),
        vi.fn(),
      )
      await started

      await vi.advanceTimersByTimeAsync(20_000)
      expect(worker.value.heartbeat).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(worker.value.heartbeat).toHaveBeenCalledTimes(2)

      releaseHeartbeat()
      await vi.advanceTimersByTimeAsync(20_000)
      expect(worker.value.heartbeat).toHaveBeenCalledTimes(3)

      releaseAgent()
      await turn
      const callsAfterFinish = vi.mocked(worker.value.heartbeat).mock.calls.length
      await vi.advanceTimersByTimeAsync(60_000)
      expect(worker.value.heartbeat).toHaveBeenCalledTimes(callsAfterFinish)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('automatic naming', () => {
  it('finishes the opening turn before reading its transcript and setting the title', async () => {
    mocked.run.mockImplementation(() => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'turn.completed' }
      },
    }))
    mocked.generateTitle.mockResolvedValue({ kind: 'titled', title: 'A concise title' })
    const worker = client()
    vi.mocked(worker.value.events).mockResolvedValue([
      {
        id: 1,
        sequence: 0,
        createdAt: '2026-08-12T00:00:00.000Z',
        event: { type: 'user_message', text: 'Build an approval flow' },
      },
      {
        id: 2,
        sequence: 2,
        createdAt: '2026-08-12T00:00:01.000Z',
        event: {
          type: 'item.completed',
          item: { id: 'answer', type: 'agent_message', status: 'completed', text: 'Which roles?' },
        },
      },
    ])

    await runTurn(
      worker.value,
      '/tmp',
      { ...claimed, userEventSequence: 0 },
      { ...conversation, title: null },
      provider,
      new AbortController(),
      vi.fn(),
    )

    expect(worker.finish).toHaveBeenCalledWith(claimed.id, 'completed')
    expect(mocked.generateTitle).toHaveBeenCalledOnce()
    expect(worker.setTitle).toHaveBeenCalledWith(claimed.id, 'A concise title')
    expect(worker.finish.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.generateTitle.mock.invocationCallOrder[0] ?? 0,
    )
  })
})
