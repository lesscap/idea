import { asContext, canResume, type ProviderConfig, runClaude } from './claude/session.ts'
import type { ClaimedTurn, Conversation, WorkerClient } from './client.ts'
import { ensureRepo, ensureWorktree, repoLayout } from './worktree.ts'

// Running one turn: prepare the context, talk to the agent, close the turn.

// How often to renew the lease. Well under the server's window, because the
// point is to survive stretches that produce no events — without renewal the
// reaper takes the turn and runs it a second time.
const HEARTBEAT_MS = 20_000

// Conversations belong directly to a workspace. Their future associations with
// apps and requirements are not single-valued, so until those have their own
// model every conversation branches from the workspace scratch repository.
const WORKSPACE_REPO = '_scratch'

export const runTurn = async (
  client: WorkerClient,
  root: string,
  claimed: ClaimedTurn,
  conversation: Conversation,
  provider: ProviderConfig,
  log: (message: string) => void,
): Promise<void> => {
  const controller = new AbortController()
  // Runs for the whole turn, including the stretches that emit nothing.
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

    ensureRepo(root, WORKSPACE_REPO, null)
    const worktree = ensureWorktree(root, WORKSPACE_REPO, conversation.id)
    const { sessions } = repoLayout(root, WORKSPACE_REPO)

    const events = await client.events(claimed.id)
    const said = events.find(
      e => e.sequence === claimed.userEventSequence && e.event.type === 'user_message',
    )
    const message = said?.event.type === 'user_message' ? said.event.text : ''

    // Resuming keeps the agent's own memory of the conversation. When there is
    // nothing local to resume — another machine ran the earlier turns, or the
    // directory was cleared — a fresh session with the transcript as context
    // keeps the conversation unbroken for the person, which is what matters.
    const resume = canResume(sessions, conversation.providerSessionId)
      ? conversation.providerSessionId
      : null
    const prompt = resume ? message : asContext(events, message)
    log(`turn ${claimed.id} in ${worktree} (${resume ? 'resuming' : 'new session'})`)

    for await (const event of runClaude({
      prompt,
      worktree,
      sessions,
      provider,
      resume,
      scope: `t${claimed.id}`,
      signal: controller.signal,
      log,
    })) {
      // Written as they arrive rather than collected and flushed: a turn that
      // dies halfway should leave what it had already said, not nothing.
      await client.emit(claimed.id, event)
    }

    await client.finish(claimed.id, 'completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`turn ${claimed.id} failed: ${message}`)
    // Recorded before the turn closes, so a failure reads as something that
    // happened rather than as a conversation that simply stopped.
    await client.emit(claimed.id, { type: 'turn.failed', error: { message } }).catch(() => {})
    await client.finish(claimed.id, 'failed').catch(() => {})
  } finally {
    clearInterval(renewing)
    controller.abort()
  }
}
