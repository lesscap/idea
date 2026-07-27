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
} from '@idea/design'
import { type FormEvent, useState } from 'react'
import { RequestError } from '../../lib/request.ts'
import { createApp } from './api.ts'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export const CreateAppDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createApp(name, description)
      setName('')
      setDescription('')
      onCreated()
      onOpenChange(false)
    } catch (err) {
      // A duplicate name comes back as a conflict; showing the server's message
      // is more useful than a generic failure.
      setError(err instanceof RequestError ? err.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>新建应用</DialogTitle>
            <DialogDescription>先起个名字，之后再把需求讲清楚。</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-name">名称</Label>
              <Input
                id="app-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：报销审批"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="app-desc">简介（选填）</Label>
              <Input
                id="app-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="这个应用是给谁用的、解决什么问题"
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
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
