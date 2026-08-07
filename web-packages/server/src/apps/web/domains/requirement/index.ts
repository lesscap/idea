import type { Controller } from '../../../../types.ts'
import { registerRequirementReads } from './read.ts'
import { registerRequirementWrites } from './write.ts'

export const RequirementsController: Controller = app => {
  registerRequirementReads(app)
  registerRequirementWrites(app)
}
