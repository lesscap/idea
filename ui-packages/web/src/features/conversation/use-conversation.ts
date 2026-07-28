import { useCallback, useEffect, useRef, useState } from 'react'
import { del, get, post } from '../../lib/request'
import { isWorking, toBubbles, type WireStored } from './transcript'

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

export type PendingInput = { id: number; text: string; createdAt: string }
export type Status = 'connecting' | 'open' | 'error' | 'closed'

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
type TranscriptPage = { items: WireStored[]; pending: PendingInput[] }

// `onConversationCreated` is required rather than optional: a caller that forgets
// it would send the first message into a conversation the URL never learns about,
// and the draft would sit there looking unsent. That should not compile.
export const useConversation = (
  conversationId: string | null,
  onConversationCreated: (id: string) => void,
) => {
  const persistedId = conversationId === 'new' ? null : conversationId
  const [events, setEvents] = useState<WireStored[]>([])
  const [pending, setPending] = useState<PendingInput[]>([])
  const [status, setStatus] = useState<Status>('connecting')
  const [loadingOlder, setLoadingOlder] = useState(false)
  // The resume point, and the cursor going the other way. Refs, so reading them
  // does not make every arriving event restart the stream.
  const lastSeq = useRef(-1)
  const oldestSeq = useRef<number | null>(null)
  // Which conversation this hook is currently bound to. A `loadOlder` still in
  // flight when the reader switches away must not splice one transcript into
  // another.
  const boundId = useRef<string | null>(persistedId)
  const fetchingOlder = useRef(false)

  const apply = useCallback(
    (incoming: WireStored[]) =>
      setEvents(previous => {
        const next = mergeEvents(previous, incoming)
        const last = next.at(-1)
        if (last) lastSeq.current = Math.max(lastSeq.current, last.sequence)
        const first = next[0]
        if (first) oldestSeq.current = first.sequence
        return next
      }),
    [],
  )

  useEffect(() => {
    boundId.current = persistedId
    if (persistedId === null) {
      setEvents([])
      setPending([])
      setStatus('closed')
      return
    }

    setEvents([])
    setPending([])
    setStatus('connecting')
    lastSeq.current = -1
    oldestSeq.current = null

    let alive = true
    let opened = false
    let loaded = false

    const backfill = (query: string) =>
      get<TranscriptPage>(`/conversations/${persistedId}/events${query}`)
        .then(page => {
          if (!alive) return
          apply(page.items)
          setPending(page.pending)
          loaded = true
          if (stream.readyState === EventSource.OPEN) setStatus('open')
        })
        .catch(() => {
          // A hole in the transcript. Reporting 'open' would claim the person is
          // seeing everything when they are not; the resume point has not moved,
          // so the next reconnect asks for the same gap again.
          if (alive) setStatus('error')
        })

    const openStream = (): EventSource => {
      const source = new EventSource(`/api/web/conversations/${persistedId}/stream`)

      source.onopen = () => {
        setStatus('open')
        // Only a REopen backfills — the first open is followed by the initial
        // read below. A reopen asks for the gap; one that never got its window
        // asks for the window again.
        if (opened) void backfill(loaded ? `?after=${lastSeq.current}` : OPENING)
        opened = true
      }

      source.onmessage = message => {
        try {
          apply([JSON.parse(message.data) as WireStored])
        } catch {
          // A frame that will not parse is not worth tearing the stream down for.
        }
      }

      source.onerror = () => setStatus('error')
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
  }, [persistedId, apply])

  // Walks back from the oldest event held. Guarded by a ref rather than the
  // rendered flag, because two clicks land before a re-render.
  const loadOlder = useCallback(async () => {
    const before = oldestSeq.current
    if (persistedId === null || before === null || before <= 0 || fetchingOlder.current) return

    fetchingOlder.current = true
    setLoadingOlder(true)
    try {
      const page = await get<TranscriptPage>(
        `/conversations/${persistedId}/events?before=${before}&limit=${OLDER_PAGE}`,
      )
      if (boundId.current === persistedId) apply(page.items)
    } catch {
      // The cursor has not moved, so pressing again retries the same stretch.
    } finally {
      fetchingOlder.current = false
      setLoadingOlder(false)
    }
  }, [persistedId, apply])

  // Not wrapped in useCallback: the panel re-renders whenever a message arrives,
  // so a stable identity buys nothing and costs a dependency array to keep right.
  const refreshPending = async () => {
    if (persistedId === null) return
    const page = await get<TranscriptPage>(
      `/conversations/${persistedId}/events?after=${lastSeq.current}`,
    )
    setPending(page.pending)
  }

  const send = async (text: string) => {
    if (conversationId === 'new') {
      const created = await post<{ id: number }>('/conversations', { text })
      onConversationCreated(String(created.id))
      return
    }
    if (persistedId === null) return
    await post(`/conversations/${persistedId}/messages`, { text })
    await refreshPending()
  }

  const withdraw = async (inputId: number) => {
    if (persistedId === null) return
    await del(`/conversations/${persistedId}/pending/${inputId}`)
    await refreshPending()
  }

  return {
    bubbles: toBubbles(events),
    pending,
    // Derived from the transcript rather than read from a status column: the log
    // already says, and a second source would be a second thing to keep in step.
    working: isWorking(events),
    status,
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
