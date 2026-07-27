import { get } from './request.ts'

export type HealthReport = {
  readonly ok: boolean
  readonly db: 'up' | 'down'
}

export const fetchHealth = (): Promise<HealthReport> => get<HealthReport>('/health')
