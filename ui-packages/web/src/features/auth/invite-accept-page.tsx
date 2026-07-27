import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@idea/design'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentUser, useRefreshSession } from '../../core/session/use-session.ts'
import { RequestError } from '../../lib/request.ts'
import { acceptInvite, previewInvite } from './api.ts'

type Preview = { workspaceName: string; invitedByName: string }

export const InviteAcceptPage = () => {
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
      setError(err instanceof RequestError ? err.message : '接受邀请失败')
    } finally {
      setBusy(false)
    }
  }

  if (invalid) {
    return (
      <Centered>
        <CardHeader>
          <CardTitle>邀请链接无效</CardTitle>
          <CardDescription>
            链接可能已被使用、已过期，或输入有误。请向邀请人索取新链接。
          </CardDescription>
        </CardHeader>
      </Centered>
    )
  }

  if (!preview) {
    return (
      <Centered>
        <CardHeader>
          <CardTitle>正在检查邀请…</CardTitle>
        </CardHeader>
      </Centered>
    )
  }

  return (
    <Centered>
      <CardHeader>
        <CardTitle>加入「{preview.workspaceName}」</CardTitle>
        <CardDescription>{preview.invitedByName} 邀请你加入这个工作空间</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={accept} className="flex flex-col gap-4">
          {user ? (
            <p className="text-sm text-muted-foreground">
              你已登录为 <strong>{user.name}</strong>，将以当前账号加入。
            </p>
          ) : (
            <>
              <Field id="name" label="姓名" value={name} onChange={setName} required />
              <Field
                id="username"
                label="用户名"
                value={username}
                onChange={setUsername}
                hint="登录用，小写字母、数字与 . _ -"
                required
              />
              <Field
                id="password"
                label="密码"
                type="password"
                value={password}
                onChange={setPassword}
                hint="至少 8 位"
                required
              />
              <Field
                id="phone"
                label="手机号（选填）"
                value={phone}
                onChange={setPhone}
                hint="以后用于找回密码"
              />
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? '处理中…' : user ? '加入' : '注册并加入'}
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
