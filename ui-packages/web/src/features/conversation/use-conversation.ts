import type { AgentEffort, Attachment, ConversationExecution, Id } from '@idea/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { del, get, patch, post } from '../../lib/request'
import { phaseOf, toBubbles, type WireStored } from './transcript'

// One conversation, kept current from two sources folded into one ordered list:
// the history behind it and the live tail in front.
//
// The tail carries no history and no cursor. Opening it FIRST and reading the
// history second is what closes the gap: anything arriving while the read is in
// flight comes down the tail and is deduplicated by id, so an overlap is
// harmless where a hole would not be.
//
// The shape is baton's (packages/web/src/features/sessions/use-session-stream.ts),
// including the reopen-on-visible below — which is not something you would think
// to write before it bit you.
//
// Windowed: opening reads the most recent events and `loadOlder` walks back from
// there. The server widens a window that would otherwise hold no turn boundary,
// so `isWorking` can still answer from what arrives — see its windowed events().

export type PendingInput = {
  id: number
  text: string
  attachments: readonly Attachment[]
  createdAt: string
}
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'error' | 'closed'
export type WorkersStatus = 'loading' | 'ready' | 'error'

export type WorkerOption = {
  id: number
  name: string
  hostname: string
  providerId: number
  providerLabel: string
  providerKind: string
  defaultModel: string
  models: readonly string[]
  efforts: Readonly<Record<string, readonly AgentEffort[]>>
}

export type ModelConfiguration = {
  kind: string | null
  defaultModel: string | null
  models: readonly string[]
  efforts: Readonly<Record<string, readonly AgentEffort[]>>
  model: string | null
  effort: AgentEffort | null
}

export type WorkerAssignment = {
  providerId: number
  worker: { id: number; name: string; hostname: string; online: boolean } | null
}

// How much transcript to open with, counted in stored events.
//
// baton reads 200 and pages back 600, because it stores raw provider stream
// lines: a tool-heavy turn is dozens of them folding into one activity group, so
// its window buys far fewer bubbles than its size suggests. Ours are already
// folded — the worker's adapter pairs tool calls with their results and emits
// whole blocks, never per-token frames — so an event here is close to a thing on
// screen and the two numbers have no reason to differ.
//
// Sized in turns rather than events: a one-exchange turn is about four events, a
// thirty-tool one about eighty, so this opens on several exchanges either way.
// Worth re-deriving against real data before trusting the figure — see the
// per-turn query in the plan that introduced this.
const HISTORY_WINDOW = 300
const OLDER_PAGE = 300

const OPENING = `?limit=${HISTORY_WINDOW}`

// Deduplicated by the server's id, ordered by per-conversation sequence. Pure, so
// the merge can be checked without a stream.
//
// One Map from both lists: its constructor takes the last value for a repeated
// key, which is the newer frame of a growing item.
export const mergeEvents = (existing: WireStored[], incoming: WireStored[]): WireStored[] =>
  incoming.length === 0
    ? existing
    : [...new Map([...existing, ...incoming].map(event => [event.id, event])).values()].sort(
        (a, b) => a.sequence - b.sequence,
      )

// The events endpoint's answer. Unrelated to `Paged<T>` — a transcript is walked
// by cursor, not by page number, because its sequences are what a reader holds.
type TranscriptPage = {
  items: WireStored[]
  pending: PendingInput[]
  execution: ConversationExecution
  assignment: WorkerAssignment
  modelConfiguration: ModelConfiguration
}

type WorkersPage = { items: WorkerOption[] }

// `onConversationCreated` is required rather than optional: a caller that forgets
// it would send the first message into a conversation the URL never learns about,
// and the draft would sit there looking unsent. That should not compile.
export const useConversation = (
  appId: Id,
  conversationId: string | null,
  onConversationCreated: (id: string) => void,
) => {
  const base = `/apps/${appId}/conversations`
  const persistedId = conversationId === 'new' ? null : conversationId
  const [events, setEvents] = useState<WireStored[]>([])
  const [pending, setPending] = useState<PendingInput[]>([])
  const [execution, setExecution] = useState<ConversationExecution>({ state: 'idle' })
  const [assignment, setAssignment] = useState<WorkerAssignment | null>(null)
  const [workers, setWorkers] = useState<WorkerOption[]>([])
  const [workersStatus, setWorkersStatus] = useState<WorkersStatus>('loading')
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const [modelConfiguration, setModelConfiguration] = useState<ModelConfiguration>({
    kind: null,
    defaultModel: null,
    models: [],
    efforts: {},
    model: null,
    effort: null,
  })
  const [draftModel, setDraftModel] = useState<string | null>(null)
  const [draftEffort, setDraftEffort] = useState<AgentEffort | null>(null)
  const [assigningWorker, setAssigningWorker] = useState(false)
  const [workerAssignmentFailed, setWorkerAssignmentFailed] = useState(false)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [stopFailed, setStopFailed] = useState(false)
  // The resume point, and the cursor going the other way. Refs, so reading them
  // does not make every arriving event restart the stream.
  const lastSeq = useRef(-1)
  const oldestSeq = useRef<number | null>(null)
  // Which conversation this hook is currently bound to. A `loadOlder` still in
  // flight when the reader switches away must not splice one transcript into
  // another.
  const boundId = useRef<string | null>(persistedId)
  const pendingRequest = useRef(0)
  const fetchingOlder = useRef(false)

  const refreshWorkers = useCallback(async () => {
    setWorkersStatus('loading')
    try {
      const page = await get<WorkersPage>(`/apps/${appId}/workers`)
      setWorkers(page.items)
      setSelectedWorkerId(current =>
        current !== null && page.items.some(worker => worker.id === current)
          ? current
          : (page.items[0]?.id ?? null),
      )
      setWorkersStatus('ready')
    } catch {
      setWorkersStatus('error')
    }
  }, [appId])

  useEffect(() => {
    void refreshWorkers()
  }, [refreshWorkers])

  useEffect(() => {
    if (persistedId !== null) return
    // A worker selects the Provider and therefore its defaults. Any worker
    // change starts the draft from those defaults again.
    if (selectedWorkerId === null) {
      setDraftModel(null)
      setDraftEffort(null)
      return
    }
    setDraftModel(null)
    setDraftEffort(null)
  }, [persistedId, selectedWorkerId])

  const apply = useCallback((incoming: WireStored[]) => {
    setEvents(previous => {
      const next = mergeEvents(previous, incoming)
      const last = next.at(-1)
      if (last) lastSeq.current = Math.max(lastSeq.current, last.sequence)
      const first = next[0]
      if (first) oldestSeq.current = first.sequence
      return next
    })
  }, [])

  useEffect(() => {
    // Retrying restarts the whole connection lifecycle; the counter's value is
    // immaterial, but reading it here makes that trigger explicit.
    void connectionAttempt
    boundId.current = persistedId
    pendingRequest.current++
    if (persistedId === null) {
      setEvents([])
      setPending([])
      setExecution({ state: 'idle' })
      setAssignment(null)
      setConnection('closed')
      setStopping(false)
      setStopFailed(false)
      return
    }

    setEvents([])
    setPending([])
    setExecution({ state: 'idle' })
    setAssignment(null)
    setModelConfiguration({
      kind: null,
      defaultModel: null,
      models: [],
      efforts: {},
      model: null,
      effort: null,
    })
    setConnection('connecting')
    setStopping(false)
    setStopFailed(false)
    lastSeq.current = -1
    oldestSeq.current = null

    let alive = true
    let opened = false
    let loaded = false

    const backfill = (query: string) => {
      const request = ++pendingRequest.current
      return get<TranscriptPage>(`${base}/${persistedId}/events${query}`)
        .then(page => {
          if (!alive) return
          apply(page.items)
          if (boundId.current === persistedId && pendingRequest.current === request) {
            setPending(page.pending)
            setExecution(page.execution)
            if (page.execution.state !== 'running') {
              setStopping(false)
              setStopFailed(false)
            }
            setAssignment(page.assignment)
            setModelConfiguration(page.modelConfiguration)
          }
          loaded = true
          if (stream.readyState === EventSource.OPEN) setConnection('open')
        })
        .catch(() => {
          // A hole in the transcript. Reporting 'open' would claim the person is
          // seeing everything when they are not; the resume point has not moved,
          // so the next reconnect asks for the same gap again.
          if (alive) setConnection('error')
        })
    }

    const openStream = (): EventSource => {
      const source = new EventSource(`/api/web${base}/${persistedId}/stream`)

      source.onopen = () => {
        // Only a REopen backfills — the first open is followed by the initial
        // read below. A reopen asks for the gap; one that never got its window
        // asks for the window again.
        if (opened) void backfill(loaded ? `?after=${lastSeq.current}` : OPENING)
        else if (loaded) setConnection('open')
        opened = true
      }

      source.onmessage = message => {
        try {
          const incoming = JSON.parse(message.data) as WireStored
          if (incoming.event.type === 'turn.started') setExecution({ state: 'running' })
          if (
            incoming.event.type === 'turn.completed' ||
            incoming.event.type === 'turn.failed' ||
            incoming.event.type === 'turn.aborted'
          ) {
            setExecution({ state: 'idle' })
            setStopping(false)
            setStopFailed(false)
          }
          apply([incoming])
          // A queued batch is deleted in the same transaction that writes its
          // user_message. Read the authoritative queue after that commit rather
          // than clearing locally: newer input may already be waiting.
          if (incoming.event.type === 'user_message') void backfill(`?after=${incoming.sequence}`)
          if (incoming.event.type === 'system' && incoming.event.action === 'model') {
            const configured = incoming.event
            setModelConfiguration(current => ({
              ...current,
              model: configured.model ?? null,
              effort: configured.effort ?? null,
            }))
          }
        } catch {
          // A frame that will not parse is not worth tearing the stream down for.
        }
      }

      source.onerror = () => setConnection('reconnecting')
      return source
    }

    let stream = openStream()

    // A backgrounded EventSource can be suspended and left reporting OPEN while
    // it is in fact dead, without ever firing `onerror` — so the browser never
    // reconnects and the conversation silently stops updating. Dropping and
    // reopening whenever the page comes back means the fresh `onopen` refills
    // whatever was missed.
    const reopen = () => {
      if (!alive) return
      stream.close()
      stream = openStream()
    }
    const onVisible = () => document.visibilityState === 'visible' && reopen()
    const onPageShow = (event: PageTransitionEvent) => event.persisted && reopen()

    void backfill(OPENING)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      stream.close()
    }
  }, [persistedId, apply, base, connectionAttempt])

  // Walks back from the oldest event held. Guarded by a ref rather than the
  // rendered flag, because two clicks land before a re-render.
  const loadOlder = useCallback(async () => {
    const before = oldestSeq.current
    if (persistedId === null || before === null || before <= 0 || fetchingOlder.current) return

    fetchingOlder.current = true
    setLoadingOlder(true)
    try {
      const page = await get<TranscriptPage>(
        `${base}/${persistedId}/events?before=${before}&limit=${OLDER_PAGE}`,
      )
      if (boundId.current === persistedId) apply(page.items)
    } catch {
      // The cursor has not moved, so pressing again retries the same stretch.
    } finally {
      fetchingOlder.current = false
      setLoadingOlder(false)
    }
  }, [persistedId, apply, base])

  // Not wrapped in useCallback: the panel re-renders whenever a message arrives,
  // so a stable identity buys nothing and costs a dependency array to keep right.
  const refreshPending = async () => {
    if (persistedId === null) return
    const request = ++pendingRequest.current
    const page = await get<TranscriptPage>(`${base}/${persistedId}/events?after=${lastSeq.current}`)
    if (boundId.current === persistedId && pendingRequest.current === request) {
      setPending(page.pending)
      setExecution(page.execution)
      if (page.execution.state !== 'running') {
        setStopping(false)
        setStopFailed(false)
      }
      setAssignment(page.assignment)
      setModelConfiguration(page.modelConfiguration)
    }
  }

  const send = async (text: string, attachmentFids: readonly string[]) => {
    if (conversationId === 'new') {
      if (selectedWorkerId === null) throw new Error('a worker is required')
      const created = await post<{ cid: string }>(base, {
        text,
        attachmentFids,
        workerId: selectedWorkerId,
        ...(draftModel ? { model: draftModel } : {}),
        ...(draftEffort ? { effort: draftEffort } : {}),
      })
      onConversationCreated(created.cid)
      return
    }
    if (persistedId === null) return
    await post(`${base}/${persistedId}/messages`, { text, attachmentFids })
    await refreshPending()
  }

  const stop = async () => {
    if (persistedId === null || execution.state !== 'running' || stopping) return
    setStopping(true)
    setStopFailed(false)
    try {
      const result = await post<{ requested: boolean }>(`${base}/${persistedId}/abort`)
      if (result.requested) return
      await refreshPending()
      setStopping(false)
    } catch {
      setStopping(false)
      setStopFailed(true)
    }
  }

  const assignWorker = async (workerId: number) => {
    if (persistedId === null || assigningWorker) return
    setAssigningWorker(true)
    setWorkerAssignmentFailed(false)
    try {
      const next = await patch<WorkerAssignment>(`${base}/${persistedId}/worker`, { workerId })
      setAssignment(next)
      setModelConfiguration(current => ({ ...current, model: null, effort: null }))
    } catch (error) {
      setWorkerAssignmentFailed(true)
      throw error
    } finally {
      setAssigningWorker(false)
    }
  }

  const withdraw = async (inputId: number) => {
    if (persistedId === null) return
    await del(`${base}/${persistedId}/pending/${inputId}`)
    pendingRequest.current++
    if (boundId.current === persistedId)
      setPending(current => current.filter(item => item.id !== inputId))
  }

  const phase = phaseOf(events, execution)
  const selectedWorker = workers.find(worker => worker.id === selectedWorkerId) ?? null
  const activeModelConfiguration =
    persistedId === null
      ? {
          kind: selectedWorker?.providerKind ?? null,
          defaultModel: selectedWorker?.defaultModel ?? null,
          models: selectedWorker?.models ?? [],
          efforts: selectedWorker?.efforts ?? {},
          model: draftModel,
          effort: draftEffort,
        }
      : modelConfiguration

  const configureModel = async (model: string | null, effort: AgentEffort | null) => {
    if (persistedId === null) {
      setDraftModel(model)
      setDraftEffort(effort)
      return
    }
    const configured = await patch<{ model: string | null; effort: AgentEffort | null }>(
      `${base}/${persistedId}/model`,
      { model, effort },
    )
    setModelConfiguration(current => ({ ...current, ...configured }))
  }

  return {
    bubbles: toBubbles(events),
    pending,
    phase,
    working: execution.state !== 'idle',
    activityLive: execution.state === 'running',
    stopping,
    stopFailed,
    stop,
    assignment,
    workers,
    workersStatus,
    selectedWorkerId,
    selectWorker: setSelectedWorkerId,
    refreshWorkers,
    assignWorker,
    assigningWorker,
    workerAssignmentFailed,
    modelConfiguration: activeModelConfiguration,
    configureModel,
    connection,
    retryConnection: () => setConnectionAttempt(attempt => attempt + 1),
    // Sequence 0 is the first thing ever said, so holding it means there is
    // nothing behind this. Read off the events rather than the cursor ref, which
    // does not re-render.
    hasOlder: (events[0]?.sequence ?? 0) > 0,
    loadingOlder,
    loadOlder,
    send,
    withdraw,
  }
}
