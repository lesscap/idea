import type { Id, IssueLabel } from '@idea/shared'
import { ArrowLeft, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input } from '../../ui'
import { createLabel, deleteLabel, listLabels, updateLabel } from './api'
import { LabelChip } from './label-chip'

const DEFAULT_COLOR = '1f6feb'

type EditorState = {
  readonly id: Id | null
  readonly name: string
  readonly description: string
  readonly color: string
}

const blankEditor = (): EditorState => ({
  id: null,
  name: '',
  description: '',
  color: DEFAULT_COLOR,
})

export const LabelManager = ({
  appId,
  openResource,
}: {
  appId: Id
  openResource: (ref: string) => void
}) => {
  const __ = useLocale()
  const [labels, setLabels] = useState<readonly IssueLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listLabels(appId).then(
      value => {
        setLabels(value)
        setLoading(false)
      },
      caught => {
        console.error('could not load labels', caught)
        setError(__('issue.labelsLoadFailed'))
        setLoading(false)
      },
    )
  }, [appId, __])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor?.name.trim()) return
    setSaving(true)
    setError(null)
    const input = {
      name: editor.name.trim(),
      description: editor.description.trim() || null,
      color: editor.color.replace('#', ''),
    }
    try {
      const saved =
        editor.id === null
          ? await createLabel(appId, input)
          : await updateLabel(appId, editor.id, input)
      setLabels(current =>
        [...current.filter(label => label.id !== saved.id), saved].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      )
      setEditor(null)
    } catch (caught) {
      console.error('could not save label', caught)
      setError(__('issue.labelSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (label: IssueLabel) => {
    if (!globalThis.confirm(__('issue.deleteLabelConfirm', label.name))) return
    setError(null)
    try {
      await deleteLabel(appId, label.id)
      setLabels(current => current.filter(item => item.id !== label.id))
      if (editor?.id === label.id) setEditor(null)
    } catch (caught) {
      console.error('could not delete label', caught)
      setError(__('issue.labelDeleteFailed'))
    }
  }

  return (
    <main className="h-full overflow-auto">
      <header className="flex items-center justify-between gap-3 border-border border-b px-5 py-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => openResource('issues')}>
          <ArrowLeft />
          {__('issue.backToIssues')}
        </Button>
        <Button size="sm" onClick={() => setEditor(blankEditor())}>
          <Plus />
          {__('issue.newLabel')}
        </Button>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-6">
        <h1 className="font-semibold text-2xl tracking-tight">{__('issue.manageLabels')}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{__('issue.manageLabelsDescription')}</p>
        {error && (
          <p
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        )}
        {editor && (
          <form
            className="mt-5 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_7rem_auto] sm:items-end"
            onSubmit={submit}
          >
            <label className="space-y-1 text-sm" htmlFor="label-name">
              <span className="font-medium">{__('issue.labelName')}</span>
              <Input
                id="label-name"
                value={editor.name}
                maxLength={50}
                required
                autoFocus
                onChange={event => setEditor({ ...editor, name: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor="label-description">
              <span className="font-medium">{__('issue.labelDescription')}</span>
              <Input
                id="label-description"
                value={editor.description}
                maxLength={100}
                onChange={event => setEditor({ ...editor, description: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor="label-color">
              <span className="font-medium">{__('issue.labelColor')}</span>
              <Input
                id="label-color"
                type="color"
                className="p-1"
                value={`#${editor.color}`}
                onChange={event => setEditor({ ...editor, color: event.target.value.slice(1) })}
              />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                {__('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? __('common.loading') : __('common.done')}
              </Button>
            </div>
          </form>
        )}
        <div className="mt-5 overflow-hidden rounded-md border border-border">
          {loading && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {__('common.loading')}
            </div>
          )}
          {!loading && labels.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Tag className="size-8 text-muted-foreground" />
              <p className="font-medium">{__('issue.noLabels')}</p>
              <p className="text-muted-foreground text-sm">{__('issue.noLabelsHint')}</p>
            </div>
          )}
          {labels.map(label => (
            <div
              key={label.id}
              className="grid grid-cols-[minmax(8rem,auto)_minmax(0,1fr)_auto] items-center gap-4 border-border border-b px-4 py-3 last:border-b-0"
            >
              <div>
                <LabelChip label={label} />
              </div>
              <p className="truncate text-muted-foreground text-sm">
                {label.description || __('issue.noDescription')}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={__('issue.editLabel', label.name)}
                  onClick={() =>
                    setEditor({
                      id: label.id,
                      name: label.name,
                      description: label.description ?? '',
                      color: label.color,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={__('issue.deleteLabel', label.name)}
                  onClick={() => void remove(label)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
