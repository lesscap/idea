import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser, useSignIn } from '../../core/session/use-session'
import { useLocale } from '../../i18n'
import { LocaleSwitch } from '../../parts/locale-switch'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../../ui'

export const LoginPage = () => {
  const __ = useLocale()
  const user = useCurrentUser()
  const signIn = useSignIn()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username, password)
      navigate(from, { replace: true })
    } catch {
      // One message for every failure. The server refuses to distinguish an
      // unknown username from a wrong password — spelling out which it was here
      // would hand back exactly what that refusal protects.
      setError(__('auth.signInFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* The one screen where the language control has to be reachable without
          an account: someone who cannot read the current language has no way
          past this page otherwise. */}
      <div className="flex justify-end p-4">
        <LocaleSwitch />
      </div>

      <div className="flex flex-1 items-center justify-center p-4 pb-24">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{__('auth.signInTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{__('auth.username')}</Label>
                <Input
                  id="username"
                  data-testid="login-username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{__('auth.password')}</Label>
                <Input
                  id="password"
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy} data-testid="login-submit">
                {busy ? __('auth.signingIn') : __('auth.signIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
