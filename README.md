# idea

A software-creation platform for business people. Someone who does not write code
describes what they need, an agent helps them get the requirement right, and the
result is software their company actually uses.

Current state: **identity and containers are done.** Sign-in, invite-based
onboarding, workspaces, and app CRUD all work. Requirement elicitation and the
agent have not been started.

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
│   └── session/     the session store (state + provider + hooks) and its API
├── features/        leaf features — they consume the layers above, never declare shared state
│   ├── auth/        login page, invite acceptance
│   ├── workspace/   workspace picker, invite dialog
│   └── app/         app list, create dialog
├── shell/           routing, auth guards, layout, cross-feature composition
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
| `features/` | consumes the layers above and declares nothing shared |
| `shell/` | two features need composing, so they get composed here |

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

One store: the current session (`user` + `workspaceId`). It qualifies because it
is read on most screens **and** has definite moments at which it goes stale —
sign in, sign out, switch workspace. That pairing is the bar for anything else
proposed for a store. An app list has no such moment, so it lives in the page
that shows it.

Rules, each protecting against a specific failure:

- **Built per provider, not at module scope.** `createStore` from
  `zustand/vanilla` behind a React Context, instantiated in a `useRef`. A
  module-level `create()` is a process-wide singleton: state survives between
  tests, and two roots on a page silently share it.
- **The base hook always takes a selector.** Subscribing to the whole store
  re-renders every consumer on any field change. It never errors — it just gets
  slower — so it has to be impossible rather than caught in review.
- **Named accessor hooks** (`useCurrentUser`) over inline selectors at call
  sites. A typo in an inline selector yields `undefined` silently; a wrong hook
  name does not compile.
- **State file holds state only.** `core/session/store.tsx` has the shape, the
  store, the provider, and the base hook. Accessors and actions live in
  `use-session.ts`.
- **Dependencies run store → api → request**, never backwards.
- **The session is not persisted.** The httpOnly cookie is the source of truth
  for being signed in; mirroring it into localStorage lets the two disagree once
  the cookie expires, and puts identity where page scripts can read it.

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

**One daemon per machine**, registering capabilities and serving every project.

A worker registers what it can *do* (`WORKER_CAPABILITIES`), not which project it
belongs to. The server matches work against connected workers by capability, and
the project travels on each command. The connection is **outbound-only** — no
inbound port, so it runs behind NAT on any machine.

Concurrency comes from slots inside one process, not from one process per task.

> baton, the reference implementation, runs one daemon per project because its
> agent works inside a git worktree and project↔repo is 1:1. Our agent elicits
> requirements and checks out no code, so that constraint is absent and the
> per-project process it forced is not worth inheriting.
>
> **The cost**: one process holds several projects' context, so a crash or a leak
> crosses project boundaries in a way per-project processes would not. Acceptable
> for an internal platform. If real isolation is ever needed, run several workers
> on the machine with disjoint capability sets — the model already allows it.

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
    `app.get(...)` and `app.workspace.roleOf()` read off one object and
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
  tested with stub services and no database.
- Code, comments, commit messages, and documentation in English; UI copy in
  Chinese.

## Credentials

Real credentials only go in gitignored `.env` files, **never in a committed
file**. The fallbacks in `src/config.ts` and `prisma.config.ts` are deliberately
harmless localhost values — do not change them to real addresses.

`.gitignore` uses `.env*` plus `!.env.example`, so a new `.env.production` is
ignored by default rather than by someone remembering to add it.

The production database URL is recorded in `.env` **as a comment**. Do not
uncomment it locally: migrations and seeds hit whichever URL is active.
Deployments inject it from the environment.

Object storage (Tencent COS) credentials are recorded but **not wired up** — no
upload feature exists yet. When one arrives, note that `COS_UPLOAD_PATH` and
`ASSET_URL_SIGNING_SECRET` must differ from other products, or object prefixes
collide and signed URLs become valid across products.

## Not built yet

- Requirement entity and the elicitation agent
- Worker registration protocol, capability matching, command stream
- SMS verification and password recovery (the phone column is stored, but a
  number must be verified before it can be used to recover an account)
- Email delivery — invite links are handed over manually for now
- Session revocation (`@hono/session` supports a storage adapter when needed)
