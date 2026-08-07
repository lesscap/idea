import type { RequirementStatus } from '@idea/shared'

const REQUIREMENT_CODE = /^R-([1-9]\d*)$/

export const requirementCode = (number: number): string => `R-${number}`

export const revisionCode = (number: number): string => `v${number}`

export const parseRequirementCode = (code: string): number | null => {
  const match = REQUIREMENT_CODE.exec(code)
  if (!match) return null
  const number = Number(match[1])
  return Number.isSafeInteger(number) ? number : null
}

export const visibleRequirementContent = <T>(
  currentRevision: T | null,
  draft: T | null,
): T | null => currentRevision ?? draft

export const requirementIsWritable = (status: RequirementStatus): boolean => status !== 'archived'
