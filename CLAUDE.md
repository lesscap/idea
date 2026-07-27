# Working conventions

Project-specific rules. See README.md for architecture and setup.

## Pages must be agent-navigable

Every page is built to be driven by automation from the moment it is written —
not retrofitted once a test gets stuck. Think of it as a tactile paving strip:
laid for one specific kind of traveller, invisible to everyone else, and useless
if it stops halfway. A page that drops its markers mid-flow sends automation back
to guessing.

The goal is that an agent knows **where to click and what state it is in**
without inferring either from the visual layout.

### Interactive elements carry `data-testid`

```tsx
<Button data-testid="user-menu">
<Input data-testid="login-username">
<DropdownMenuItem data-testid="menu-invite">
<Card data-testid={`workspace-${w.id}`}>   // list items use a template
```

kebab-case, semantic. Add it when writing the component, not later.

### Containers publish their state as `data-*`

```tsx
<div
  data-testid="app-shell"
  data-username={user?.username}
  data-role={role ?? 'none'}
  data-workspace-id={workspaceId ?? ''}
  data-locale={locale}
>
```

One read of `document.querySelector('[data-testid=app-shell]').dataset` answers
who is signed in, where they are, what they may do, and in which language — no
API call, no reading it back out of rendered text.

**Only non-sensitive identifiers.** Never a token, phone number, or anything
else that would matter if it leaked into a DOM dump.

### Why text is not enough

Snapshot refs are renumbered on every call. Similar labels collide — "默认空间"
is the workspace switcher while "平台管理员" is the account menu. And after
i18n, every text-based locator breaks the moment someone switches language.
`data-testid` survives re-renders and translation.

The same markers serve e2e tests, so this is not overhead spent only on agents.

### Repeated flows become scripts

`scripts/ui-session.sh` handles sign-in, sign-out, and switching accounts. The
session cookie is httpOnly, so signing out goes through the API
(`fetch('/api/web/session', { method: 'DELETE' })`) rather than hunting for a
menu item.

## Language

Chinese in conversation and UI copy. English in code, comments, documentation,
and commit messages.
