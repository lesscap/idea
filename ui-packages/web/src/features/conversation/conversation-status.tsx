import { useLocale } from '../../i18n'
import type { ConversationPhase } from './transcript'
import type { ConnectionStatus } from './use-conversation'

type Props = {
  connection: ConnectionStatus
  phase: ConversationPhase
  onRetry: () => void
}

const PHASE_MESSAGE = {
  queued: 'queued',
  thinking: 'thinking',
  working: 'working',
  streaming: 'streaming',
} as const

export const ConversationStatus = ({ connection, phase, onRetry }: Props) => {
  const __ = useLocale()

  const connectionMessage =
    connection === 'connecting'
      ? 'connecting'
      : connection === 'reconnecting'
        ? 'reconnecting'
        : connection === 'error'
          ? 'loadFailed'
          : null
  const message = connectionMessage ?? (phase === 'idle' ? null : PHASE_MESSAGE[phase])
  if (!message) return null

  const failed = message === 'loadFailed'

  return (
    <div
      className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-muted-foreground text-xs"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="conversation-status"
      data-state={message}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-pulse"
      />
      <span className="min-w-0 flex-1 leading-relaxed">{__(`transcript.status.${message}`)}</span>
      {failed && (
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRetry}
        >
          {__('common.retry')}
        </button>
      )}
    </div>
  )
}
