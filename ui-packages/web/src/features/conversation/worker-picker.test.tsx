import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../i18n'
import type { WorkerOption } from './use-conversation'
import {
  NewConversationWorker,
  NewConversationWorkerControl,
  RecoveryWorker,
} from './worker-picker'

const workers: WorkerOption[] = [
  {
    id: 1,
    name: '客户工作站',
    hostname: 'customer.local',
    providerId: 5,
    providerLabel: 'GLM',
    providerKind: 'claude',
    defaultModel: 'glm-5.2',
    models: [],
    efforts: {},
  },
  {
    id: 2,
    name: 'Mac mini',
    hostname: 'mini.local',
    providerId: 6,
    providerLabel: 'DeepSeek',
    providerKind: 'claude',
    defaultModel: 'deepseek-v4-pro[1m]',
    models: [],
    efforts: {},
  },
]

const locale = (node: ReactNode) => render(<LocaleProvider>{node}</LocaleProvider>)

describe('worker selection', () => {
  it('shows the selected online worker for a new conversation', () => {
    locale(
      <NewConversationWorker
        workers={workers}
        status="ready"
        selectedId={1}
        onSelect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByTestId('worker-select')).toHaveValue('1')
    expect(screen.getByRole('option', { name: '客户工作站 · GLM' })).toBeInTheDocument()
    expect(screen.queryByText(/working files/i)).not.toBeInTheDocument()
  })

  it('offers only replacements using the conversation provider', () => {
    const onAssign = vi.fn()
    locale(
      <RecoveryWorker
        assignment={{ providerId: 5, worker: null }}
        workers={workers}
        status="ready"
        busy={false}
        failed={false}
        onAssign={onAssign}
        onRefresh={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId('worker-replacement'), { target: { value: '1' } })

    expect(onAssign).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('option', { name: 'Mac mini' })).not.toBeInTheDocument()
  })
})

describe('compact worker control', () => {
  it('shows a loading state', () => {
    locale(
      <NewConversationWorkerControl
        workers={[]}
        status="loading"
        selectedId={null}
        onSelect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByTestId('worker-control-loading')).toBeDisabled()
  })

  it('changes the selected worker', () => {
    const onSelect = vi.fn()
    locale(
      <NewConversationWorkerControl
        workers={workers}
        status="ready"
        selectedId={1}
        onSelect={onSelect}
        onRefresh={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId('worker-control'), { target: { value: '2' } })

    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it.each([
    ['ready' as const, '当前没有在线工作站。'],
    ['error' as const, '无法加载工作站。'],
  ])('offers retry for the %s state', (status, label) => {
    const onRefresh = vi.fn()
    locale(
      <NewConversationWorkerControl
        workers={[]}
        status={status}
        selectedId={null}
        onSelect={vi.fn()}
        onRefresh={onRefresh}
      />,
    )

    fireEvent.click(screen.getByTestId('worker-control-retry'))

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
