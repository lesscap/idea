import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentUser, useRefreshSession } from '../../core/session/use-session'
import { useLocale } from '../../i18n'
import { useErrorMessage } from '../../i18n/use-error-message'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '../../ui'
import { acceptInvite, previewInvite } from './api'

type Preview = { workspaceName: string; invitedByName: string }

export const InviteAcceptPage = () => {
  const __ = useLocale()
  const errorMessage = useErrorMessage()
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const refresh = useRefreshSession()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    previewInvite(token)
      .then(setPreview)
      // Unknown, expired, and already-used all arrive the same way, and are
      // shown the same way — telling them apart would leak facts about
      // invitations the visitor does not hold.
      .catch(() => setInvalid(true))
  }, [token])

  const accept = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Someone already signed in joins as themselves. Without this branch they
      // would have to invent a second account to accept an invitation to a
      // second workspace.
      await acceptInvite(
        token,
        user ? undefined : { username, password, name, phone: phone || undefined },
      )
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (invalid) {
    return (
      <Centered>
        <CardHeader>
          <CardTitle>{__('invite.invalid')}</CardTitle>
          <CardDescription>{__('invite.invalidHint')}</CardDescription>
        </CardHeader>
      </Centered>
    )
  }

  if (!preview) {
    return (
      <Centered>
        <CardHeader>
          <CardTitle>{__('invite.checking')}</CardTitle>
        </CardHeader>
      </Centered>
    )
  }

  return (
    <Centered>
      <CardHeader>
        <CardTitle>{__('invite.joinTitle', preview.workspaceName)}</CardTitle>
        <CardDescription>{__('invite.invitedBy', preview.invitedByName)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={accept} className="flex flex-col gap-4">
          {user ? (
            <p className="text-sm text-muted-foreground">{__('invite.signedInAs', user.name)}</p>
          ) : (
            <>
              <Field id="name" label={__('invite.name')} value={name} onChange={setName} required />
              <Field
                id="username"
                label={__('auth.username')}
                value={username}
                onChange={setUsername}
                hint={__('invite.usernameHint')}
                required
              />
              <Field
                id="password"
                label={__('auth.password')}
                type="password"
                value={password}
                onChange={setPassword}
                hint={__('invite.passwordHint')}
                required
              />
              <Field
                id="phone"
                label={__('invite.phone')}
                value={phone}
                onChange={setPhone}
                hint={__('invite.phoneHint')}
              />
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy
              ? __('invite.processing')
              : user
                ? __('invite.join')
                : __('invite.registerAndJoin')}
          </Button>
        </form>
      </CardContent>
    </Centered>
  )
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card className="w-full max-w-sm">{children}</Card>
  </div>
)

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  required?: boolean
}

const Field = ({ id, label, value, onChange, type, hint, required }: FieldProps) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
    />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
)
