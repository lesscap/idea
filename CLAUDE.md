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

## Frontend layers

`ui-packages/web/src` is layered, and each name states its relationship. A layer
is defined by what it may *import*, not by what it happens to contain.

```clojure
;; May-import graph. Each set is complete — transitivity is not implied, so
;; adding an edge is always a deliberate act rather than a side effect.
(def may-import
  {:ui       #{}                                   ; generic React primitives: button, input, dialog
   :core     #{:ui}                                ; mechanism: the i18n engine, the session store
   :i18n     #{:core}                              ; message bundles + assembly
   :parts    #{:ui :core :i18n}                    ; shared components/hooks that know this product
   :features #{:ui :core :i18n :parts}             ; leaf capabilities, each owning its own API calls
   :shell    #{:ui :core :i18n :parts :features}}) ; composition: layout, routing, resource registry

;; The one-way rule is a property of that map, not a separate convention:
(assert (not (contains? (may-import :features) :shell)))
```

So a feature that needs to reach back into the shell is telling you the shell
should be passing it a prop. `features/conversation/conversation-list.tsx` takes
`conversationId` and `onSelect` rather than the shell's `Workspace` object for
exactly this reason.

`ui/` versus `parts/` is the line worth guarding, because it erodes quietly — a
component picks up one business import and nothing complains. Keep the test
mechanical rather than a judgement call:

```clojure
(defn belongs-in-ui? [component]
  (empty? (intersection (imports component) #{:core :i18n :shared})))

;; A dropdown is :ui. A language switcher that saves the choice to your account
;; reaches :core, so it is :parts.
```

## Documentation style

Prose for reasoning — why a decision was made, what it cost, what it rules out.

Clojure for anything with structure or logic: dependency graphs, matching rules,
state machines, decision flows. An s-expression states a rule once and exactly,
where a table or a paragraph only depicts it and leaves the reader to reconstruct
what it means. It is notation, not code to be run — nothing compiles it.

## Language

Chinese in conversation and UI copy. English in code, comments, documentation,
and commit messages.
