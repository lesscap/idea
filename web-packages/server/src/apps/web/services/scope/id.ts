import type { Id } from '@idea/shared'

export const positiveId = (value: string | undefined): Id | null => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
