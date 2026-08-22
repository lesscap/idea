import type { Controller } from '../../types.ts'
import { AppsController } from './controllers/apps.ts'
import {
  ConversationsController,
  WorkspaceConversationsController,
} from './controllers/conversation/index.ts'
import {
  AppFilesController,
  FilesController,
  WorkspaceFilesController,
} from './controllers/files.ts'
import { InvitesController } from './controllers/invites.ts'
import { SessionController } from './controllers/session.ts'
import { AppWorkersController, WorkspaceWorkersController } from './controllers/workers.ts'
import { WorkspacesController } from './controllers/workspaces.ts'
import { IssuesController } from './domains/issue/index.ts'
import { LabelsController } from './domains/issue/labels.ts'
import { requireSession } from './middleware/session.ts'

// The browser-facing surface. A sibling `apps/worker/` will mount at
// /api/worker with a bearer-token stack instead — keeping them in separate
// directories is what stops a worker route from silently inheriting cookie auth.
export const BASE = '/api/web'

// Because a controller is `(app) => void`, cross-cutting concerns are ordinary
// function wrappers. Middleware registered inside the wrapper lands on the
// controller's own sub-instance, so it applies to that prefix and nothing else.
const guarded =
  (controller: Controller): Controller =>
  app => {
    app.use('*', requireSession)
    controller(app)
  }

// Reads as the access policy: public routes above, guarded ones below.
//
// `/session` is deliberately NOT guarded — POST is the login endpoint and cannot
// require the session it issues. Its authenticated routes apply requireSession
// individually. Do not "tidy" this by wrapping it.
export const Routes: Record<string, Controller> = {
  '/session': SessionController,
  '/invites': InvitesController,
  '/workspaces': guarded(WorkspacesController),
  '/apps/:appId/files': guarded(AppFilesController),
  '/apps/:appId/workers': guarded(AppWorkersController),
  '/apps/:appId/conversations': guarded(ConversationsController),
  '/apps/:appId/issues': guarded(IssuesController),
  '/apps/:appId/labels': guarded(LabelsController),
  '/workspace/files': guarded(WorkspaceFilesController),
  '/workspace/workers': guarded(WorkspaceWorkersController),
  '/workspace/conversations': guarded(WorkspaceConversationsController),
  '/apps': guarded(AppsController),
  '/files': guarded(FilesController),
}
