import { join } from 'node:path'
import { asContext, userPrompt } from './agent/context.ts'
import { type AgentAdapter, agentFor, type ProviderConfig } from './agent/index.ts'
import { attachmentPath, materializeAttachments } from './attachments.ts'
import { extractSeed } from './claude/title.ts'
import type { ClaimedTurn, Conversation, Provider, WorkerClient } from './client.ts'
import { ensureRepo, ensureWorktree, repoLayout } from './worktree.ts'

// Running one turn: prepare the context, talk to the agent, close the turn.

// How often to renew the lease. Well under the server's window, because the
// point is to survive stretches that produce no events — without renewal the
// reaper takes the turn and runs it a second time.
const HEARTBEAT_MS = 20_000

const startLeaseRenewal = (
  renew: () => Promise<void>,
  failed: (error: unknown) => void,
): (() => Promise<void>) => {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null

  const schedule = () => {
    timer = setTimeout(() => {
      if (stopped) return
      running = renew()
        .catch(failed)
        .finally(() => {
          running = null
          if (!stopped) schedule()
        })
    }, HEARTBEAT_MS)
  }
  schedule()

  return async () => {
    stopped = true
    clearTimeout(timer)
    await running
  }
}

// Conversations belong directly to a workspace. Their future associations with
// apps and requirements are not single-valued, so until those have their own
// model every conversation branches from the workspace scratch repository.
const WORKSPACE_REPO = '_scratch'

export const runTurn = async (
  client: WorkerClient,
  root: string,
  claimed: ClaimedTurn,
  conversation: Conversation,
  provider: Provider,
  controller: AbortController,
  log: (message: string) => void,
): Promise<void> => {
  const agent = agentFor(provider.kind)
  const heartbeat = async () => {
    const state = await client.heartbeat(claimed.id)
    if (state.abortRequested) controller.abort()
  }
  let stopRenewal: () => Promise<void> = async () => undefined

  try {
    await heartbeat()
    controller.signal.throwIfAborted()
    // Schedule only after the first renewal completes, and only after each
    // subsequent request settles. Slow network calls therefore cannot overlap
    // and accumulate while the agent is quiet.
    stopRenewal = startLeaseRenewal(heartbeat, error =>
      log(`turn ${claimed.id} heartbeat failed: ${String(error)}`),
    )
    await client.emit(claimed.id, {
      type: 'turn.started',
      sourceSequence: claimed.userEventSequence,
    })

    ensureRepo(root, WORKSPACE_REPO, null)
    const worktree = ensureWorktree(root, WORKSPACE_REPO, conversation.id)
    const { sessions, codex } = repoLayout(root, WORKSPACE_REPO)

    const events = await client.events(claimed.id)
    const said = events.find(
      e => e.sequence === claimed.userEventSequence && e.event.type === 'user_message',
    )
    if (said?.event.type !== 'user_message') throw new Error('turn user message not found')
    await materializeAttachments(client, worktree, events)
    const current =
      provider.kind === 'codex'
        ? {
            ...said.event,
            attachments: said.event.attachments?.filter(
              attachment => !attachment.contentType.startsWith('image/'),
            ),
          }
        : said.event

    // Resuming keeps the agent's own memory of the conversation. When there is
    // nothing local to resume — another machine ran the earlier turns, or the
    // directory was cleared — a fresh session with the transcript as context
    // keeps the conversation unbroken for the person, which is what matters.
    const stateHome = provider.kind === 'codex' ? codex : sessions
    const resume = agent.canResume(stateHome, conversation.providerSessionId)
      ? conversation.providerSessionId
      : null
    const prompt = resume
      ? userPrompt(current)
      : asContext(
          events.filter(event => event.sequence < claimed.userEventSequence),
          current,
        )
    log(`turn ${claimed.id} in ${worktree} (${resume ? 'resuming' : 'new session'})`)
    const model = said.event.model ?? provider.config.model
    const effort = said.event.effort ?? null
    const images = (said.event.attachments ?? [])
      .filter(attachment => attachment.contentType.startsWith('image/'))
      .map(attachment => join(worktree, attachmentPath(attachment)))

    for await (const event of agent.run({
      prompt,
      worktree,
      sessions,
      codexHome: codex,
      provider: provider.config,
      model,
      effort,
      images,
      resume,
      scope: `t${claimed.id}`,
      signal: controller.signal,
      log,
    })) {
      // Written as they arrive rather than collected and flushed: a turn that
      // dies halfway should leave what it had already said, not nothing.
      await client.emit(claimed.id, event)
    }

    await stopRenewal()
    controller.signal.throwIfAborted()
    await client.finish(claimed.id, 'completed')

    // Name it after the opening turn. The transcript read below may also contain
    // follow-up input queued while that turn ran; that still describes the same
    // opening subject and is useful context rather than a boundary to reconstruct.
    if (claimed.userEventSequence === 0 && conversation.title === null)
      await nameConversation(
        client,
        claimed.id,
        { agent, provider: provider.config, worktree, sessions: stateHome },
        log,
      )
  } catch (error) {
    if (controller.signal.aborted) {
      log(`turn ${claimed.id} stopped`)
      await client
        .emit(claimed.id, {
          type: 'turn.aborted',
          reason: 'interrupted',
          sourceSequence: claimed.userEventSequence,
        })
        .catch(closeError =>
          log(`turn ${claimed.id} could not record abort: ${String(closeError)}`),
        )
      await client
        .finish(claimed.id, 'aborted')
        .catch(closeError =>
          log(`turn ${claimed.id} could not finish abort: ${String(closeError)}`),
        )
      return
    }

    const message = error instanceof Error ? error.message : String(error)
    log(`turn ${claimed.id} failed: ${message}`)
    // Recorded before the turn closes, so a failure reads as something that
    // happened rather than as a conversation that simply stopped.
    await client
      .emit(claimed.id, { type: 'turn.failed', error: { message } })
      .catch(closeError =>
        log(`turn ${claimed.id} could not record failure: ${String(closeError)}`),
      )
    await client
      .finish(claimed.id, 'failed')
      .catch(closeError =>
        log(`turn ${claimed.id} could not finish failure: ${String(closeError)}`),
      )
  } finally {
    await stopRenewal()
  }
}

// Never throws. It runs inside the same `try` as the turn, and the catch there
// writes a `turn.failed` event — so an exception escaping here would put a
// failure at the end of a conversation that actually went fine, for no reason
// worse than a summariser timing out.
//
// Reads the transcript back rather than collecting from the stream on the way
// past: what gets summarised is exactly what was stored at naming time, and the
// loop above keeps doing one thing.
const nameConversation = async (
  client: WorkerClient,
  turnId: number,
  where: {
    agent: AgentAdapter
    provider: ProviderConfig
    worktree: string
    sessions: string
  },
  log: (message: string) => void,
): Promise<void> => {
  try {
    const seed = extractSeed(await client.events(turnId))
    if (!seed) return log(`turn ${turnId}: too little said to name the conversation`)

    const outcome = await where.agent.generateTitle({ ...where, seed })
    if (outcome.kind === 'error') return log(`turn ${turnId}: naming failed — ${outcome.reason}`)
    if (outcome.kind === 'declined') return log(`turn ${turnId}: nothing worth naming yet`)

    const named = await client.setTitle(turnId, outcome.title)
    log(named ? `✎ named conversation → ${outcome.title}` : `turn ${turnId}: already named`)
  } catch (error) {
    log(`turn ${turnId}: naming failed — ${error instanceof Error ? error.message : String(error)}`)
  }
}
