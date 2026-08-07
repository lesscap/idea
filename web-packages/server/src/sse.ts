import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'

// The pump behind every server-sent stream here.
//
// Extracted because there are two of them — the worker's command stream and a
// conversation's transcript — and each got the same four things wrong
// independently until they were written once.
//
// Writes are SERIALISED through a queue. Writing from inside the subscriber
// callback is the obvious shape and is wrong: `writeSSE` is asynchronous, so two
// events arriving close together interleave their frames on one connection.
// Pushing to a queue and draining it in an awaited loop keeps one write in
// flight at a time.

// Live only: no history, no replay. History is an ordinary paginated read, and a
// client that reconnects asks for what it missed by sequence — so this stream
// carries no resume state and a dropped connection costs one request rather than
// a correctness problem. (baton splits them the same way, with the client's
// `onopen` triggering the gap read.)
export const streamBus = <T>(
  c: Context,
  subscribe: (push: (item: T) => void) => () => void,
  toData: (item: T) => string,
) => {
  // The request's own signal rather than the streaming helper's callback: it is
  // the same fact from the source, and it is already aborted if the client left
  // during setup.
  const { signal } = c.req.raw

  return streamSSE(c, async stream => {
    let wake = (): void => {}
    const pending: T[] = []
    const nudge = () => {
      const resume = wake
      wake = () => {}
      resume()
    }

    // Subscribed before history is read, so nothing that happens during the read
    // falls between the two.
    const unsubscribe = subscribe(item => {
      pending.push(item)
      nudge()
    })
    signal.addEventListener('abort', nudge)

    // A stream that has said nothing is indistinguishable from one that hung:
    // EventSource fires neither `onopen` nor `onerror` and simply waits. A
    // conversation with no history is exactly that case, so this opening comment
    // is the ordinary path rather than an edge one.
    await stream.write(': open\n\n')

    const keepalive = setInterval(() => {
      if (signal.aborted) return
      stream.write(': keepalive\n\n').catch(() => {})
    }, 25_000)

    try {
      while (!signal.aborted) {
        while (pending.length > 0 && !signal.aborted) {
          const item = pending.shift()
          if (item === undefined) continue
          await stream.writeSSE({ data: toData(item) })
        }
        if (signal.aborted) break
        await new Promise<void>(resume => {
          wake = resume
        })
      }
    } finally {
      clearInterval(keepalive)
      unsubscribe()
      signal.removeEventListener('abort', nudge)
    }
  })
}
