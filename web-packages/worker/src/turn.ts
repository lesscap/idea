import type { ClaimedTurn, Conversation, WorkerClient } from './client.ts'
import { ensureRepo, ensureWorktree } from './worktree.ts'

// Running one turn: prepare the context, do the work, close the turn.
//
// The agent is not wired up in this slice. What is being settled here is
// everything around it — that a claim leads to a prepared worktree, that the
// lease is renewed while work is in progress, and that the turn is closed
// exactly once whatever happens. Dropping a model call into `respond` below
// changes this file and nothing else.

// How often to renew the lease. Well under the server's window, because the
// point is to survive a single tool call that produces no other event for
// minutes — without renewal the reaper takes the turn and runs it again.
const HEARTBEAT_MS = 20_000

// Which repository backs a conversation. An app that has one of its own gets
// it; a conversation attached to nothing gets the workspace's, so the agent
// always has somewhere to work and there is one code path rather than two.
const repoKey = (conversation: Conversation): string =>
  conversation.appId === null
    ? `workspace-${conversation.workspaceId}`
    : `app-${conversation.appId}`

export type TurnContext = {
  worktree: string
  conversation: Conversation
}

export const prepare = (root: string, conversation: Conversation): TurnContext => {
  // Always the local path today: App carries no remote yet. When it grows one,
  // the argument below becomes that field and the clone branch in ensureRepo —
  // already written and reached by the tests — starts being used.
  const repo = ensureRepo(root, repoKey(conversation), null)
  return {
    worktree: ensureWorktree(root, repo.path, conversation.id),
    conversation,
  }
}

export const runTurn = async (
  client: WorkerClient,
  root: string,
  claimed: ClaimedTurn,
  conversation: Conversation,
  log: (message: string) => void,
): Promise<void> => {
  // Renewal runs for the whole turn, including the parts that emit nothing.
  // Cleared in `finally` so a failure cannot leave a timer holding a lease on a
  // turn nobody is running.
  const renewing = setInterval(() => {
    void client.heartbeat(claimed.id).catch(() => {})
  }, HEARTBEAT_MS)

  try {
    await client.emit(claimed.id, {
      type: 'turn.started',
      sourceSequence: claimed.userEventSequence,
    })

    const context = prepare(root, conversation)
    log(`turn ${claimed.id} in ${context.worktree}`)

    await respond(client, claimed, context)

    await client.emit(claimed.id, { type: 'turn.completed' })
    await client.finish(claimed.id, 'completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`turn ${claimed.id} failed: ${message}`)
    // Recorded in the transcript before the turn is closed, so a failed turn
    // reads as something that happened rather than as a conversation that
    // simply stopped.
    await client.emit(claimed.id, { type: 'turn.failed', error: { message } }).catch(() => {})
    await client.finish(claimed.id, 'failed').catch(() => {})
  } finally {
    clearInterval(renewing)
  }
}

// The agent's reply. A placeholder that names itself — the transcript should not
// imply a model was consulted when none was.
const respond = async (
  client: WorkerClient,
  claimed: ClaimedTurn,
  context: TurnContext,
): Promise<void> => {
  await client.emit(claimed.id, {
    type: 'item.completed',
    item: {
      id: `placeholder-${claimed.id}`,
      status: 'completed',
      type: 'agent_message',
      text: `The agent is not connected yet. Working directory: ${context.worktree}`,
    },
  })
}
