import { Button } from '@idea/design'
import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, type HealthReport } from '../api/health.ts'

type Status =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly report: HealthReport }
  | { readonly state: 'error'; readonly message: string }

// Placeholder home page. It exists to prove the wiring end to end: React →
// request wrapper → Vite proxy → Hono controller → health service → Postgres.
export const HomePage = () => {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  const refresh = useCallback(() => {
    setStatus({ state: 'loading' })
    fetchHealth()
      .then(report => setStatus({ state: 'ready', report }))
      .catch((err: Error) => setStatus({ state: 'error', message: err.message }))
  }, [])

  useEffect(refresh, [refresh])

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-10">
      <h1 className="text-xl font-semibold">idea</h1>
      <p style={{ color: 'var(--idea-color-text-muted)' }}>软件创作平台 · 骨架</p>

      <section
        className="flex flex-col gap-2 p-4"
        style={{
          background: 'var(--idea-color-surface)',
          border: '1px solid var(--idea-color-border)',
          borderRadius: 'var(--idea-radius-lg)',
        }}
      >
        <strong>服务状态</strong>
        {status.state === 'loading' && <span>检查中…</span>}
        {status.state === 'ready' && (
          <span>
            服务 {status.report.ok ? '正常' : '异常'} · 数据库{' '}
            {status.report.db === 'up' ? '已连接' : '未连接'}
          </span>
        )}
        {status.state === 'error' && (
          <span style={{ color: 'var(--idea-color-danger)' }}>连接失败：{status.message}</span>
        )}
      </section>

      <div>
        <Button onClick={refresh}>重新检查</Button>
      </div>
    </main>
  )
}
