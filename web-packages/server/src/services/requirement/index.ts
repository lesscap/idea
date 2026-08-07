import type { Service } from '../../types.ts'
import { createRequirementReads } from './read.ts'
import type {
  RequirementCommandResult,
  RequirementScope,
  RequirementService,
  RequirementWriteResult,
} from './types.ts'
import { createRequirementCommands } from './write.ts'

export type {
  ConfirmRequirementInput,
  CreateRequirementInput,
  RequirementScope,
  RequirementService,
  RequirementWriteResult,
  SaveRequirementDraftInput,
} from './types.ts'

export const createRequirementService: Service<RequirementService> = app => {
  const reads = createRequirementReads(app)
  const commands = createRequirementCommands(app)
  const completed = async (
    scope: RequirementScope,
    result: RequirementCommandResult,
  ): Promise<RequirementWriteResult> => {
    if (result.kind !== 'ok') return result
    const requirement = await reads.get(scope, result.requirementId)
    if (!requirement) throw new Error('requirement disappeared after a committed write')
    return { kind: 'ok', requirement }
  }

  return {
    ...reads,
    create: async input => completed(input, await commands.create(input)),
    saveDraft: async input => completed(input, await commands.saveDraft(input)),
    confirm: async input => completed(input, await commands.confirm(input)),
  }
}
