import { useEffect, useRef, useState } from 'react'
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
// NOT windowed: opening reads the whole transcript. baton pages a recent window
// because its sessions reach thousands of events and megabytes; ours are a
// handful of turns, and paging needs a "load earlier" control to go with it.
// Worth doing when a conversation gets long enough to notice, not before.

export type PendingInput = { id: number; text: string; createdAt: string }
export type Status = 'connecting' | 'open' | 'error' | 'closed'

// Deduplicated by the server's id, ordered by per-conversation sequence. Pure, so
// the merge can be checked without a stream.
export const mergeEvents = (existing: WireStored[], incoming: WireStored[]): WireStored[] => {
  if (incoming.length === 0) return existing
  const byId = new Map<number, WireStored>()
  for (const event of existing) byId.set(event.id, event)
  for (const event of incoming) byId.set(event.id, event)
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence)
}

type Page = { items: WireStored[]; pending: PendingInput[] }

export const useConversation = (conversationId: string | null) => {
  const [events, setEvents] = useState<WireStored[]>([])
  const [pending, setPending] = useState<PendingInput[]>([])
  const [status, setStatus] = useState<Status>('connecting')
  // The resume point. A ref, so reading it does not make every arriving event
  // restart the stream.
  const lastSeq = useRef(-1)

  useEffect(() => {
    if (conversationId === null) {
      setEvents([])
      setPending([])
      setStatus('closed')
      return
    }

    setEvents([])
    setPending([])
    setStatus('connecting')
    lastSeq.current = -1

    let alive = true
    let opened = false
    let loaded = false

    const apply = (incoming: WireStored[]) =>
      setEvents(previous => {
        const next = mergeEvents(previous, incoming)
        const last = next.at(-1)
        if (last) lastSeq.current = Math.max(lastSeq.current, last.sequence)
        return next
      })

    const backfill = (query: string) =>
      get<Page>(`/conversations/${conversationId}/events${query}`)
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
      const source = new EventSource(`/api/web/conversations/${conversationId}/stream`)

      source.onopen = () => {
        setStatus('open')
        // Only a REopen backfills — the first open is followed by the initial
        // read below.
        if (opened) void backfill(loaded ? `?after=${lastSeq.current}` : '')
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

    void backfill('')
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      stream.close()
    }
  }, [conversationId])

  // Not wrapped in useCallback: the panel re-renders whenever a message arrives,
  // so a stable identity buys nothing and costs a dependency array to keep right.
  const refreshPending = async () => {
    if (conversationId === null) return
    const page = await get<Page>(`/conversations/${conversationId}/events?after=${lastSeq.current}`)
    setPending(page.pending)
  }

  const send = async (text: string) => {
    if (conversationId === null) return
    await post(`/conversations/${conversationId}/messages`, { text })
    await refreshPending()
  }

  const withdraw = async (inputId: number) => {
    if (conversationId === null) return
    await del(`/conversations/${conversationId}/pending/${inputId}`)
    await refreshPending()
  }

  return {
    bubbles: toBubbles(events),
    pending,
    // Derived from the transcript rather than read from a status column: the log
    // already says, and a second source would be a second thing to keep in step.
    working: isWorking(events),
    status,
    send,
    withdraw,
  }
}
