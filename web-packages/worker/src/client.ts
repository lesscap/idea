import type { ConversationEvent, StoredEvent } from '@idea/shared'
import type { ProviderConfig } from './agent/index.ts'

// The only way this process reaches anything shared. The worker holds no
// database credentials on purpose: it may run on a machine outside the network
// perimeter, and shipping them there would be wrong.

export type ClaimedTurn = {
  id: number
  conversationId: number
  userEventSequence: number
  attempt: number
}

export type Conversation = {
  id: number
  cid: string
  appId: number
  providerId: number
  workerId: number | null
  // The provider's handle for this conversation. Null before the first turn, or
  // after one had to start a new session.
  providerSessionId: string | null
  title: string | null
}

// Endpoint and model, sent with the claim. Not secret — the credential is named
// by `tokenEnv` and read from this process's own environment.
export type Provider = { kind: string; config: ProviderConfig }

export type RegisterInput = {
  enrolmentToken: string
  provider: string
  machineId: string
  name: string
  hostname: string
}

export type WorkerClient = {
  register: (input: RegisterInput) => Promise<{ id: number; token: string; outcome: string }>
  claim: () => Promise<{
    turn: ClaimedTurn
    conversation: Conversation | null
    provider: Provider | null
  } | null>
  events: (turnId: number, after?: number) => Promise<StoredEvent[]>
  downloadFile: (fid: string) => Promise<Response>
  emit: (turnId: number, event: ConversationEvent) => Promise<void>
  heartbeat: (turnId: number) => Promise<boolean>
  finish: (turnId: number, outcome: 'completed' | 'failed' | 'aborted') => Promise<void>
  // Names the conversation this turn belongs to. False means it already had a
  // name — a person got there first — which is an outcome to log, not retry.
  setTitle: (turnId: number, title: string) => Promise<boolean>
  // The watchdog's ping. Rejects when the server cannot be reached, which is the
  // signal the daemon uses to exit.
  ping: () => Promise<void>
  stream: (onCommand: (command: { type: string }) => void, signal: AbortSignal) => Promise<void>
}

// Unwraps the API envelope, or throws with whatever the server said went wrong.
// The caller names the payload it expects — a failed call throws rather than
// returning a shape to check, so there is one error path instead of two.
const unwrap = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; message?: string }
    | null

  if (body?.success !== true)
    throw new Error(`${response.status} ${body?.message ?? response.statusText}`)

  return body.data
}

export const createClient = (server: string, token?: string): WorkerClient => {
  const base = `${server.replace(/\/$/, '')}/api/worker`
  let bearer = token

  const call = async <T>(path: string, init: RequestInit = {}) =>
    unwrap<T>(
      await fetch(`${base}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          ...(init.headers ?? {}),
        },
      }),
    )

  const post = <T>(path: string, body?: unknown) =>
    call<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  return {
    register: async input => {
      const data = await post<{ worker: { id: number }; apiToken: string; outcome: string }>(
        '/workers',
        input,
      )
      // Held in memory only. It is reissued on every registration, so persisting
      // it would buy nothing and leave a credential on disk.
      bearer = data.apiToken
      return { id: data.worker.id, token: data.apiToken, outcome: data.outcome }
    },

    claim: async () => {
      const data = await post<{
        turn: ClaimedTurn | null
        conversation: Conversation | null
        provider: Provider | null
      }>('/turns/claim')
      return data.turn
        ? { turn: data.turn, conversation: data.conversation, provider: data.provider }
        : null
    },

    events: async (turnId, after) =>
      (
        await call<{ items: StoredEvent[] }>(
          `/turns/${turnId}/events${after === undefined ? '' : `?after=${after}`}`,
        )
      ).items,

    downloadFile: async fid => {
      const response = await fetch(`${base}/files/${encodeURIComponent(fid)}`, {
        headers: { authorization: `Bearer ${bearer}` },
      })
      if (!response.ok || !response.body) {
        throw new Error(`file ${fid} download failed: ${response.status}`)
      }
      return response
    },

    emit: async (turnId, event) => {
      await post(`/turns/${turnId}/events`, event)
    },

    heartbeat: async turnId =>
      (await post<{ renewed?: boolean }>(`/turns/${turnId}/events`, { type: 'turn.heartbeat' }))
        .renewed === true,

    finish: async (turnId, outcome) => {
      await post(`/turns/${turnId}/finish`, { outcome })
    },

    setTitle: async (turnId, title) =>
      (await post<{ named?: boolean }>(`/turns/${turnId}/title`, { title })).named === true,

    ping: async () => {
      await post('/workers/heartbeat')
    },

    // Live-only by design: nothing is replayed, because a command is a nudge and
    // the queue it points at is durable. Resolves when the connection ends, so
    // the caller decides whether to reconnect.
    stream: async (onCommand, signal) => {
      const response = await fetch(`${base}/workers/me/stream`, {
        headers: { authorization: `Bearer ${bearer}` },
        signal,
      })
      if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        // SSE frames are separated by a blank line; anything after the last one
        // is a partial frame and stays in the buffer.
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const data = frame
            .split('\n')
            .find(line => line.startsWith('data:'))
            ?.slice(5)
            .trim()
          if (data) onCommand(JSON.parse(data))
        }
      }
    },
  }
}
