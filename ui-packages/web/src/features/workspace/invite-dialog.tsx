import type { Id } from '@idea/shared'
import { useState } from 'react'
import { useLocale } from '../../i18n'
import { useErrorMessage } from '../../i18n/use-error-message'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../ui'
import { createInvite } from './api'

type Props = {
  workspaceId: Id
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const InviteDialog = ({ workspaceId, open, onOpenChange }: Props) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const { token } = await createInvite(workspaceId, 'member')
      setLink(`${window.location.origin}/invite/${token}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const close = (next: boolean) => {
    if (!next) {
      setLink(null)
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{__('invite.title')}</DialogTitle>
          <DialogDescription>{__('invite.description')}</DialogDescription>
        </DialogHeader>

        {/* Before generating there is nothing to show — the description above
            already says what the button will do. */}
        {link && (
          <div className="flex flex-col gap-2">
            <Input readOnly value={link} onFocus={e => e.currentTarget.select()} />
            {/* The server keeps only a digest of the token, so this really is
                the one and only copy — saying so is not decoration. */}
            <p className="text-sm text-destructive">{__('invite.copyNow')}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          {link ? (
            <>
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>
                {__('common.copy')}
              </Button>
              <Button onClick={() => close(false)}>{__('common.done')}</Button>
            </>
          ) : (
            <Button onClick={generate} disabled={busy}>
              {busy ? __('invite.generating') : __('invite.generate')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
