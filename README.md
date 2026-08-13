# idea

A software-creation platform for business people. Someone who does not write code
describes what they need, an agent helps them get the requirement right, and the
result is software their company actually uses.

Current state: **you can hold a conversation with the agent.** Sign-in,
invite-based onboarding, workspaces and app CRUD work; a conversation runs a real
model (GLM or DeepSeek), streams its answer into the interface, and resumes on
the next turn. The agent has no tools yet — see Worker process model for why that
is a deliberate line rather than an unfinished one.

## Getting started

```bash
pnpm install                      # installs, and runs prisma generate

cp .env.example web-packages/core/.env      # prisma CLI reads this
cp .env.example web-packages/server/.env    # server runtime reads this
cp .env.example web-packages/worker/.env    # worker reads this
# Set DATABASE_URL to the real dev database (not in the repo — ask the team).
# Generate the server's AUTH_SECRET:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

pnpm db:migrate                   # create the tables

# Bootstrap the first user. Access is invite-only, and invites can only be sent
# by an admin of an existing workspace — so without this there is no workspace
# and nobody who can send the first invite.
pnpm --filter @idea/core seed:admin \
  --username admin01 --password 'your-password' --workspace 'Default'

pnpm dev                          # server and web in parallel
```

A worker is what actually answers. It needs an enrolment token — which says
which workspace it may serve, because it cannot name its own — and the name of a
provider from the registry:

```bash
pnpm --filter @idea/core seed:system      # providers and idempotent system backfills

# Credentials go in web-packages/worker/.env, named by each provider's tokenEnv:
#   IDEA_PROVIDER_GLM_TOKEN=…
#   IDEA_PROVIDER_DEEPSEEK_TOKEN=…

IDEA_ENROLMENT_TOKEN=… IDEA_PROVIDER=glm pnpm --filter @idea/worker dev
```

Development-only demo data is kept separate from the built-in system seed and
can be applied independently:

```bash
pnpm --filter @idea/core seed:demo
pnpm --filter @idea/core seed:demo:requirements
pnpm --filter @idea/server seed:demo:requirement-media
```

`seed:system` is safe to rerun in production: besides built-in providers, it
backfills workspace-owned internal Apps and converges legacy draft Apps to the
current active default. `seed:providers` remains an alias for compatibility.
Demo commands refuse production-looking databases.

Without one, a message sits queued and nothing answers — which is what
`scripts/conversation.mjs` says when it times out.

Open http://localhost:5300 and sign in with the account you just created.

Running one package at a time:

```bash
pnpm --filter @idea/server dev
pnpm --filter @idea/web    dev
pnpm --filter @idea/worker dev
```

Common commands:

```bash
pnpm typecheck        # tsc --noEmit in every package
pnpm test             # vitest in every package
pnpm lint             # biome lint
pnpm check            # format + typecheck + test; run before committing
pnpm db:generate      # regenerate the prisma client
pnpm db:migrate       # create a migration
```

| Service | Port |
|---|---|
| server (Hono API) | 3300 |
| web (Vite dev) | 5300 |

The backend namespaces its surface **by client type**: `/api/web/*` for browsers
(session cookie), and later `/api/worker/*` for the worker daemon (bearer token).
Their middleware stacks have nothing in common, and mounting them separately is
what makes "which auth applies to this route" a structural fact rather than
something to remember. The directory layout mirrors it: `server/src/apps/web/`.

`/health` has no prefix and stays at the root — it is for load balancers and
deployment probes, not for any client.

The Vite proxy passes `/api` through **unchanged** (the backend listens on
`/api/web/*` itself). A reverse proxy plays the same role in production.

> **Local gotcha**: if your shell sets `http_proxy` / `https_proxy`, curl to
> localhost gets hijacked and returns 502. Add `--noproxy '*'`:
> ```bash
> curl -s --noproxy '*' http://localhost:3300/health
> ```

The database defaults to the shared remote dev instance. To work fully offline,
`docker-compose.yml` starts a local Postgres 17 — point `DATABASE_URL` at the
localhost value in `.env.example`.

## Packages

Grouped by **runtime target**, not by layer.

```
packages/shared/        @idea/shared   cross-runtime contracts: envelope, paging, domain types
web-packages/core/      @idea/core     backend kernel: prisma schema/client, crypto, resource scope
web-packages/server/    @idea/server   Hono API
web-packages/worker/    @idea/worker   agent worker daemon
ui-packages/web/        @idea/web      React SPA
```

Dependencies run one way. Nothing enforces this, but the marked edge is
deliberate — read the reason before changing it.

```
shared ← core ← server
shared ← core ← (future task runner)
shared ← worker              ← does NOT depend on core
shared ← web
```

**The worker does not depend on core and holds no database credentials.** Not an
oversight: it may run on a machine outside the network perimeter, and shipping
database credentials there would be wrong. It talks to the server over HTTP only.
Before adding data access, ask why it cannot go through the API.

`ui-packages/` holds one package today. The grouping stays because it is part of
the by-runtime-target split, and a second frontend would land there.

## Frontend structure

```
ui-packages/web/src/
├── ui/              UI primitives — one directory per component
│   ├── index.ts     the single entry point the rest of the app imports from
│   ├── button/index.tsx  input/index.tsx  label/index.tsx  card/index.tsx
│   ├── badge/index.tsx   dialog/index.tsx  dropdown-menu/index.tsx
│   └── preview/index.tsx component gallery, mounted at /dev/ui
├── core/            application-level infrastructure
│   ├── store.tsx    the single shared state container (data only)
│   ├── session/     session selectors, actions and API
│   └── layout/      layout selectors, actions and preference persistence
├── parts/           shared components that know this product (locale switch)
├── i18n/            message bundles and the assembly that binds them
├── features/        leaf features — they consume the layers above, never declare shared state
│   ├── auth/        login page, invite acceptance
│   ├── workspace/   workspace picker, invite dialog
│   ├── conversation/ the panel, its transcript reducer and stream hook
│   └── app/         app list, create dialog
├── shell/           routing, auth guards and cross-feature composition
│   ├── components/  account, workspace and brand controls shared by both shells
│   ├── workspace/   signed-in home, apps, workspace chat and management shell
│   └── app-studio/  app chat, resource navigation, tabs and app-studio URL state
├── lib/             non-React utilities (fetch wrapper, cn)
└── styles.css       Tailwind entry, design tokens, @theme bindings
```

Feature-first rather than layer-first: with layers, adding one feature means
touching five directories and no single place shows what that feature contains.

Each layer answers one question about what belongs in it:

| Directory | Test for belonging |
|---|---|
| `ui/` | **could this drop into an entirely different product unchanged?** |
| `lib/` | does not import react |
| `core/` | shared across features, with a definite moment at which it goes stale |
| `parts/` | shared like `ui/`, but knows a domain type — so it cannot live there |
| `features/` | consumes the layers above and declares nothing shared |
| `shell/` | two features need composing, so they get composed here |

`WorkspaceShell` and `AppStudioShell` are separate layout boundaries. They may
both import `shell/components/`, but do not import one another. Workspace chat
is persisted against an internal App referenced by `Workspace.systemAppId`;
that App is resolved only by `/api/web/workspace/*` and is excluded from every
public App list and mutation. Run `seed:system` after migrations to backfill the
internal App for existing workspaces and converge legacy App defaults.

The may-import graph is in `CLAUDE.md`, written once so it does not drift between
two files.

**Nothing under `ui/` may know a domain type** — no `@idea/shared`, no `core/`,
no `features/`. This used to be enforced by a package boundary (`@idea/design`);
that package was merged back in once it became clear there was only ever going to
be one consumer, so the rule now rests on convention plus a grep. A component
that needs structured data takes primitive props from its caller.

**One directory per component**, not one file. Components grow extra files — a
variant, an internal sub-component, a test — and a directory absorbs that without
any caller changing its import. `card` and `dialog` already export five or six
named components each.

The shell directory is called `shell/`, not `app/`, because `App` is a domain
entity here — two meanings of "app" in import paths would be a permanent tax.

### Naming

Directories and files are kebab-case, in exactly two shapes: `a-b-c/` and
`a-b-c.tsx`. `index.ts` / `index.tsx` is the one exception — an entry marker,
not a name.

Worth stating because React component files invite PascalCase to match the
component name (`Button.tsx`), and a case-insensitive filesystem hides that drift
on macOS right up until a Linux CI box rejects it.

### Component preview

`/dev/ui` renders every primitive in its full state matrix — all Button variants
and sizes including disabled, Input in normal/invalid/disabled, Dialog and
DropdownMenu open. Running the real app only exercises the states that app
happens to use, so a broken `disabled` style goes unnoticed until someone reaches
for it.

It also gives a login-free place to check Dialog keyboard behaviour after a
change: Escape closes, Tab stays trapped inside, focus returns to the trigger.
That behaviour is why these are built on Radix rather than by hand.

It ships in production as well. "dev" in the path names the audience, not the
environment: the page reads no data and exposes nothing, and being reachable on a
deployed build is what lets you check how that build actually renders. Roughly
4 kB, which is not worth the environment-conditional machinery needed to strip
it.

## State (zustand)

One shared store holds the small set of facts needed across otherwise independent
features: current session context and shell layout preferences today, perhaps a
current app id later. It is a state container, not a home for operations. Each
domain builds named selectors and actions around it under `core/session`,
`core/layout`, or another focused module.

Data still needs a definite invalidation point to enter the store. An app list
has no single moment at which every consumer can know it is stale, so it stays in
the page that owns the query rather than becoming global state.

Rules, each protecting against a specific failure:

- **Built per provider, not at module scope.** `createStore` from
  `zustand/vanilla` behind a React Context, instantiated in a `useRef`. A
  module-level `create()` is a process-wide singleton: state survives between
  tests, and two roots on a page silently share it.
- **The base hook always takes a selector.** Subscribing to the whole store
  re-renders every consumer on any field change. It never errors — it just gets
  slower — so it has to be impossible rather than caught in review.
- **Named domain hooks** (`useCurrentUser`, `useConversationCollapsed`) over
  inline selectors at call sites. A typo in an inline selector yields
  `undefined` silently; a wrong hook name does not compile.
- **The store holds data only.** `core/store.tsx` has the shape, construction,
  provider and base selector hook. Session and layout operations live in their
  own modules, so adding one does not turn the shared store into a service.
- **Domains depend on the store, never the reverse.** Store initialization takes
  plain data; layout reads its Local Storage preferences before passing them in.
- **The session is not persisted.** The httpOnly cookie is the source of truth
  for being signed in; mirroring it into localStorage lets the two disagree once
  the cookie expires, and puts identity where page scripts can read it.
- **Layout preferences are persisted.** They carry no identity or authorization,
  and their layout module owns both read and write policy.

No TanStack Query yet. It earns its place once several interrelated views start
needing "changing A must refresh B"; today that problem does not exist.

## Authorization

Three layers, each answering exactly one question, with no overlap:

| Layer | Carrier | Answers |
|---|---|---|
| Platform | a row in `platform_admins` | may you **create** a workspace |
| Workspace | `UserWorkspace.role` | may you **administer members** here |
| Visibility | a row in `UserWorkspace` | may you **see** this workspace at all |

The third layer is the important one: **visibility depends only on membership**,
never on role and never on platform admin. Roles gate administrative actions and
nothing else. That keeps tenant isolation to one thing to audit instead of a role
check scattered through every handler.

None of the three is a column on `users`. That table answers "who are you", and
permission requirements can grow without ever pushing into it.

| Action | Requires |
|---|---|
| Create a workspace | a `platform_admins` row |
| See a workspace and everything in it | membership |
| Create / edit / archive an app | membership |
| Create an invite link | workspace `admin` |
| Change a role / remove a member | workspace `admin` |

Two invariants worth stating:

- **The last admin cannot be removed or demoted.** Otherwise the workspace keeps
  its data and members but nobody can invite, promote, or delete — recoverable
  only by editing the database by hand.
- **A platform admin sees no workspace they are not a member of.** The capability
  to create is not the right to read. Checked by a test, because this is the
  distinction that keeps a single field from defeating tenant isolation.

Apps are not role-gated: the workspace is the trust boundary, and everyone inside
it is a colleague.

### Invites

An invite is a **bearer link with no addressee** — the admin generating it does
not know who will use it, which is precisely why the login identifier is a
username the invitee chooses rather than an email the inviter must know.

Single use. Only the SHA-256 digest is stored, so the link is shown exactly once
and the UI says so. Someone who already has an account joins as themselves rather
than being pushed into a duplicate account.

## API conventions

Contracts live in `@idea/shared` (pure data shapes, transport-agnostic). HTTP
status codes live in `server/src/http.ts` — status is HTTP's business and does
not belong in a contract package.

**Success**

```json
{ "success": true, "data": { } }
```

**Failure** — flat, with no nested `error` object:

```json
{ "success": false, "code": "not_found", "message": "app 12 does not exist" }
```

A discriminated union, so `success` alone tells the compiler which half exists
and callers never write `data?.`:

```ts
const res = (await fetch(...).then(r => r.json())) as ApiResponse<Foo>
if (!isOk(res)) return handle(res.code)   // res.code is typed here
use(res.data)                             // res.data is typed here
```

`code` is a stable string to branch on; `message` is human-facing and free to
change.

**Paging** lives inside `data`, not in a sibling `meta`:

```json
{ "success": true, "data": { "items": [], "total": 128, "page": 2, "pageSize": 20 } }
```

That keeps a paged response an ordinary `ApiResponse<Paged<T>>`, so `ok()`,
`isOk()`, and the browser request wrapper all work on it unchanged. A `meta` key
would force every consumer to learn a second envelope shape.

`totalPages` is derived via a helper, never stored — a stored copy can disagree
with `total` and `pageSize`.

`parsePageQuery` **clamps rather than rejects**: `?pageSize=999999` returns the
maximum of 100, `?page=0` returns page 1. Partly usability, mainly safety —
`pageSize` becomes a SQL `LIMIT`, so unclamped it is a free full-table read. The
response echoes the effective `pageSize` so a clamped client can tell.

```ts
const query = parsePageQuery(c.req.query())
const { offset, limit } = toOffset(query)
const [items, total] = await Promise.all([
  app.prisma.foo.findMany({ skip: offset, take: limit }),
  app.prisma.foo.count(),
])
return sendOk(c, paged(items, total, query))
```

**Error codes pair with statuses** in one factory each, so `not_found` cannot go
out as 400 from one controller and 404 from another:

| Factory | HTTP | code |
|---|---|---|
| `badRequest(c, msg)` | 400 | `bad_request` |
| `unauthorized(c)` | 401 | `unauthorized` |
| `forbidden(c)` | 403 | `forbidden` |
| `notFound(c)` | 404 | `not_found` |
| `conflict(c, msg)` | 409 | `conflict` |
| `unprocessable(c, msg)` | 422 | `unprocessable` |
| `internal(c)` | 500 | `internal` |

Domain-specific failures use `failWith(c, status, code, message)` — a custom code
to branch on, same envelope.

**No exits from the envelope**: `createApp` registers `notFound` and `onError`,
so unmatched routes and uncaught exceptions return it too. Without them the
framework's plain-text `404 Not Found` would be the one response the browser
wrapper cannot parse, and it would surface as a misleading `bad_response`.
`onError` logs the stack and returns a generic message — uncaught errors here are
often driver failures whose text carries connection details.

Controllers go through `http.ts` helpers, never raw `c.json`.

**Cross-tenant access answers 404, not 403.** A 403 confirms the id exists, which
is enough to enumerate resources by walking ids.

## Worker process model

**One worker per workspace, running one agent backend.**

That binding is a security boundary before it is a routing rule. The agent
executes instructions that arrive from outside — a message someone typed, and
later the contents of a repository it reads — so the process running it is
confined to one tenant's data. The server's claim query filters by workspace as
well, so even a worker that escaped its own confinement is not handed anyone
else's work.

A worker cannot name its own workspace: it presents an enrolment token and the
token decides. The connection is **outbound-only** — no inbound port, so it runs
behind NAT on any machine.

```
IDEA_ENROLMENT_TOKEN   which workspace this worker may serve
IDEA_PROVIDER          which backend it runs, by registry name (glm, deepseek, codex)
IDEA_WORKER_HOME       where repos, worktrees and agent sessions live
WORKER_SLOTS           how many turns may run at once (default 4)
```

The worker selected for the first message fixes the conversation's Provider.
Workers may move within that Provider; the native thread stays the same and the
model/effort may change between turns from Composer or `/model <model> [effort]`.
Provider `models` are suggestions only, so a newly available model may be typed
before the registry is updated; the SDK reports unsupported combinations on the
next turn.

Codex uses its normal local login under
`$IDEA_WORKER_HOME/apps/_scratch/codex`. Authenticate that persistent worker
home before starting a Codex worker:

```
pnpm --filter @idea/worker codex:login
```

Nothing is kept alive between turns. A conversation resumes from the transcript
on the server, the branch in its repository, and the agent's own session beside
the worktree — so idle conversations cost no processes, and concurrency is a slot
count rather than a process count.

The worker is the execution boundary. Claude Code runs with its native tool
surface and Codex runs with `workspace-write` plus `approvalPolicy: never`, so a
worker should be deployed only in the workspace-scoped container or machine it
is intended to modify.

Per-workspace also gives the container a job to do beyond isolation: a
workspace's skills, repositories and sessions all live in one volume, so loading
them never has to reason about more than one tenant.

## Conventions

- **Internal packages export source, no build step**: `exports` points at
  `src/index.ts`, there is no `dist`. Node runs `.ts` via `tsx` in both dev and
  production.
- **ESM throughout**, relative imports carry the `.ts` / `.tsx` extension.
- **Named exports only.** Config files that must default-export (vite, prisma)
  carry an inline `biome-ignore`.
- **Functional, no classes.**
- **Controllers and services share an arity-1 signature**:
  - `Service<T> = (app: ServiceApplication) => T` — a factory closing over the app
  - `Controller = (app: WebApplication) => void`, where
    `WebApplication = Hono & ServiceApplication`
  - Each prefix gets its own sub-instance with the services merged onto it, so
    `app.get(...)` and `app.$workspace.roleOf()` read off one object and
    controller-registered middleware stays scoped to that prefix
  - Cross-cutting concerns are ordinary function wrappers — see `guarded` in
    `server/src/apps/web/routes.ts`
  - Wiring in `server/src/context.ts` is written out by name, not iterated over a
    registry, so the dependency graph is readable and compiler-checked
  - Resource-owning factories return `[value, dispose]` and the scope releases in
    reverse
- **No Store/Repository layer over Prisma.** Prisma is already the data-access
  abstraction; wrapping it would forward `findMany` and duplicate every type. The
  one rule: **Prisma appears only in `services/`, never in a controller** — a
  controller that queries directly binds the HTTP shape to the data shape and
  forces a database into every test.
- **Tests cover observable behaviour**, not implementation. Controllers are
  tested with stub services and no database; services whose mechanism *is* the
  database — turn claiming is a unique index rejecting a concurrent write — run
  against a real one in a throwaway schema. A mock there would only confirm the
  author's expectations, which is the thing being checked.
- Code, comments, commit messages, and documentation in English; UI copy in
  Chinese.

## Scripts

Two, and neither is a test. Both need a running server — and `conversation.mjs`
needs a running worker and real provider credentials — so they cannot go in
`pnpm test`, and automating them would mean standing up a fake model endpoint and
then testing the fake.

```bash
scripts/ui-session.sh as admin 'admin@2026'      # sign the browser in
scripts/conversation.mjs "我想做一个报销审批系统"   # a whole conversation, no browser
scripts/conversation.mjs --conversation 3 "还要能导出"
```

`conversation.mjs` is the one to reach for after changing anything in the
pipeline: it signs in, creates a conversation, sends, waits for the turn to
finish and prints the transcript — so "the model answered" and "the interface
rendered it" can be told apart. Every run also checks that the provider's raw
payload never left the server.

What each layer covers:

| | covers | when |
|---|---|---|
| `pnpm test` | event normalisation, merging and withdrawal, claim races, `raw` containment | before every commit |
| `conversation.mjs` | the whole pipeline, against a real model | after changing it |

## Credentials

Real credentials only go in gitignored `.env` files, **never in a committed
file**. The fallbacks in `src/config.ts` and `prisma.config.ts` are deliberately
harmless localhost values — do not change them to real addresses.

`.gitignore` uses `.env*` plus `!.env.example`, so a new `.env.production` is
ignored by default rather than by someone remembering to add it.

The production database URL is recorded in `.env` **as a comment**. Do not
uncomment it locally: migrations and seeds hit whichever URL is active.
Deployments inject it from the environment.

Private file uploads use AliCloud OSS. The server signs a five-minute V4
PostObject policy, the browser uploads directly to the bucket, and the server
confirms the object with HEAD before making it readable. Objects live below the
fixed `idea/files` prefix and are reached through authenticated
`/api/web/files/:fid` URLs rather than permanent OSS URLs.

Production requires `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OSS_BUCKET`
and `OSS_REGION`; `OSS_ENDPOINT` defaults from the region. The bucket must be
private, and its CORS rules must allow the application's origins to use POST,
GET and HEAD. The RAM identity needs only `oss:PutObject` and `oss:GetObject`
under `upivot-s2/idea/files/*`; do not grant `oss:PutObjectAcl`.

## Not built yet

- **The worker container.** Until it exists the agent has no tools; the two land
  together
- **Skills** — what the agent asks about, and in what order. Installed per
  workspace, which is why they wait for the container
- Requirement entity, and turning a conversation into structured requirements
- The Codex adapter. It differs from Claude in a way that matters: no
  `SessionStore` hook, so its transcript has to be materialised into
  `$CODEX_HOME/sessions` before a turn and read back after
- Maths and diagram rendering (KaTeX, mermaid) in the conversation panel
- SMS verification and password recovery (the phone column is stored, but a
  number must be verified before it can be used to recover an account)
- Email delivery — invite links are handed over manually for now
- Session revocation (`@hono/session` supports a storage adapter when needed)
