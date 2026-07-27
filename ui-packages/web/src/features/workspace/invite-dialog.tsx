import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@idea/design'
import type { Id } from '@idea/shared'
import { useState } from 'react'
import { RequestError } from '../../lib/request.ts'
import { createInvite } from './api.ts'

type Props = {
  workspaceId: Id
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const InviteDialog = ({ workspaceId, open, onOpenChange }: Props) => {
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
      setError(err instanceof RequestError ? err.message : '生成邀请失败')
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
          <DialogTitle>邀请成员</DialogTitle>
          <DialogDescription>
            生成一条邀请链接发给对方。链接不绑定任何身份，谁拿到谁能用，且只能使用一次。
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-2">
            <Input readOnly value={link} onFocus={e => e.currentTarget.select()} />
            {/* The server keeps only a digest of the token, so this really is
                the one and only copy — saying so is not decoration. */}
            <p className="text-sm text-destructive">请立即复制。关闭后无法再次查看这条链接。</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">对方将自行设置用户名和密码。</p>
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
                复制链接
              </Button>
              <Button onClick={() => close(false)}>完成</Button>
            </>
          ) : (
            <Button onClick={generate} disabled={busy}>
              {busy ? '生成中…' : '生成邀请链接'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
