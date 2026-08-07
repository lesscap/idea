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

export const EditAppDialog = ({ app, open, onOpenChange, onUpdated }: Props) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const [name, setName] = useState(app.name)
  const [slug, setSlug] = useState(app.slug)
  const [description, setDescription] = useState(app.description ?? '')
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
          slug,
          description: description || null,
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
            <DialogTitle>{__('app.edit')}</DialogTitle>
            <DialogDescription>{__('app.editDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-app-name">{__('app.name')}</Label>
              <Input
                id="edit-app-name"
                data-testid="edit-app-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder={__('app.namePlaceholder')}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-app-slug">{__('app.slug')}</Label>
              <Input
                id="edit-app-slug"
                data-testid="edit-app-slug"
                value={slug}
                onChange={event => setSlug(event.target.value)}
                placeholder={__('app.slugPlaceholder')}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                minLength={2}
                maxLength={48}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-app-description">{__('app.description')}</Label>
              <Input
                id="edit-app-description"
                data-testid="edit-app-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder={__('app.descriptionPlaceholder')}
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
            <Button type="submit" disabled={busy} data-testid="edit-app-submit">
              {busy ? __('app.saving') : __('app.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
