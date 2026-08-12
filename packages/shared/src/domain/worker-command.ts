import type { Id } from '../ids.ts'

export type WorkerCommand =
  | { readonly type: 'work_available' }
  | { readonly type: 'abort'; readonly turnId: Id }
