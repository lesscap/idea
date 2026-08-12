// The interface contract between the browser and the server. TYPES ONLY.
//
// No helper, no constant, no type guard. The rule is not stylistic: a function
// that looks shareable nearly always turns out to have one caller. Parsing and
// clamping a page query is the server's alone; narrowing an envelope is a
// `body.success` test at either end; normalizing a username was here for years
// on the strength of a browser that never called it. Each one put a single
// runtime's logic somewhere both runtimes depend on, and made a private decision
// look like an agreement.
//
// When something genuinely belongs to both, it is the SHAPE that does — say the
// shape here and let each side act on it.
//
// This is also why the package has no tests: `pnpm typecheck` is what checks it.
// Anything here that wants a test has stopped being a type.
export * from './api.ts'
export * from './domain/app.ts'
export * from './domain/conversation-event.ts'
export * from './domain/file.ts'
export * from './domain/invite.ts'
export * from './domain/requirement.ts'
export * from './domain/user.ts'
export * from './domain/worker-command.ts'
export * from './domain/workspace.ts'
export * from './ids.ts'
export * from './paging.ts'
