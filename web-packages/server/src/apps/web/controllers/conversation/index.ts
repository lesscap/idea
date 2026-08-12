import type { Controller } from '../../../../types.ts'
import { registerMessages } from './messages.ts'
import { registerModelConfiguration } from './model.ts'
import { registerRead } from './read.ts'
import { registerStream } from './stream.ts'
import { registerWorkerAssignment } from './worker.ts'

// Split by what each group of routes is for rather than by how many lines it
// came to: reading the resource, watching it live, and putting something into
// it. The live stream in particular is long enough that having it beside the
// list endpoint made both harder to find.
export const ConversationsController: Controller = app => {
  registerRead(app)
  registerStream(app)
  registerMessages(app)
  registerModelConfiguration(app)
  registerWorkerAssignment(app)
}
