import type { App } from '@idea/shared'
import { type FormEvent, useState } from 'react'
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
  Label,
} from '../../ui'
import { deleteApp } from './api'

type Props = {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (slug: string) => void
}

export const DeleteAppDialog = ({ app, open, onOpenChange, onDeleted }: Props) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmed = confirmation === app.name

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      await deleteApp(app.slug)
      onDeleted(app.slug)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'app'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={__('common.close')}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{__('app.delete')}</DialogTitle>
            <DialogDescription>{__('app.deleteDescription', app.name)}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-app-confirmation">{__('app.deleteConfirm', app.name)}</Label>
              <Input
                id="delete-app-confirmation"
                data-testid="delete-app-confirmation"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                disabled={busy}
                autoComplete="off"
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {__('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || !confirmed}
              data-testid="delete-app-submit"
            >
              {busy ? __('app.deleting') : __('app.delete')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
