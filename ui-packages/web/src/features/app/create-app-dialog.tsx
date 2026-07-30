import { type FormEvent, useState } from 'react'
import { useLocale } from '../../i18n'
import { useErrorMessage } from '../../i18n/use-error-message'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../ui'
import { createApp } from './api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (app: Awaited<ReturnType<typeof createApp>>) => void
}

export const CreateAppDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const app = await createApp({ name, slug, description })
      setName('')
      setSlug('')
      setDescription('')
      onCreated(app)
      onOpenChange(false)
    } catch (err) {
      // Translated from the envelope's `code`, scoped to this feature so a
      // `conflict` reads as "that name is taken" rather than the server's
      // English sentence.
      setError(errorMessage(err, 'app'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No DialogDescription here, so aria-describedby is explicitly cleared —
          Radix warns about a missing description otherwise, and pointing it at
          nothing is the correct signal that there deliberately isn't one. */}
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{__('app.create')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-name">{__('app.name')}</Label>
              <Input
                id="app-name"
                data-testid="app-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={__('app.namePlaceholder')}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-slug">{__('app.slug')}</Label>
              <Input
                id="app-slug"
                data-testid="app-slug"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder={__('app.slugPlaceholder')}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                minLength={3}
                maxLength={48}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-desc">{__('app.description')}</Label>
              <Input
                id="app-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {__('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy} data-testid="app-submit">
              {busy ? __('app.creating') : __('app.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
