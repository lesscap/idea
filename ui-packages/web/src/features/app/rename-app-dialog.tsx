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
import { updateApp } from './api'

type Props = {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (app: App) => void
}

export const RenameAppDialog = ({ app, open, onOpenChange, onUpdated }: Props) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const [name, setName] = useState(app.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onUpdated(
        await updateApp(app.id, {
          name,
        }),
      )
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
            <DialogTitle>{__('app.rename')}</DialogTitle>
            <DialogDescription>{__('app.renameDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-app-name">{__('app.name')}</Label>
              <Input
                id="rename-app-name"
                data-testid="rename-app-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder={__('app.namePlaceholder')}
                required
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
            <Button type="submit" disabled={busy} data-testid="rename-app-submit">
              {busy ? __('app.saving') : __('app.rename')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
