# Working conventions

Project-specific rules. See README.md for architecture and setup.

## Pages must be agent-navigable

An agent must be able to tell **where to click and what state it is in** without
inferring either from the visual layout. Add the markers when writing the
component, not once a test gets stuck.

Interactive elements carry a semantic kebab-case `data-testid`:

```tsx
<Button data-testid="user-menu">
<Card data-testid={`workspace-${w.id}`}>   // list items use a template
```

Containers publish their state as `data-*`, so one `dataset` read answers the
whole situation:

```tsx
<div data-testid="app-shell" data-username={…} data-role={…} data-locale={…}>
```

**Only non-sensitive identifiers.** Never a token, phone number, or anything else
that would matter in a DOM dump.

Repeated flows become scripts — see `scripts/ui-session.sh`.

## Frontend layers

`ui-packages/web/src` is layered. A layer is defined by what it may *import*, not
by what it happens to contain.

```clojure
;; Each set is complete — transitivity is not implied, so adding an edge is a
;; deliberate act rather than a side effect.
(def may-import
  {:ui       #{}                                   ; generic React primitives
   :core     #{:ui}                                ; mechanism: i18n, shared store + domain adapters
   :i18n     #{:core}                              ; message bundles
   :parts    #{:ui :core :i18n}                    ; shared components that know this product
   :features #{:ui :core :i18n :parts}             ; leaf capabilities
   :shell    #{:ui :core :i18n :parts :features}}) ; layout, routing, resource registry

;; The one-way rule is a property of that map, not a separate convention:
(assert (not (contains? (may-import :features) :shell)))

;; ui/ versus parts/ is mechanical, not a judgement call:
(defn belongs-in-ui? [component]
  (empty? (intersection (imports component) #{:core :i18n :shared})))
```

A feature must not import shell implementation. Cross-feature state coordination
goes through a focused core adapter such as `core/layout`; other shell behavior
is passed as a prop.

## Database

Schema comes from migrations, never hand-written DDL — not in seeds, not in test
fixtures.

Prefer the model API over `$queryRaw`. A generated `update` takes the same row
lock and, unlike raw SQL, is always aimed at the right schema.

## Imports

Frontend: no file extension, no `/index`. Backend: extensions required — tsx
resolves them at runtime.

## Documentation style

Prose for reasoning. Clojure for structure and logic — dependency graphs,
matching rules, state machines. An s-expression states a rule once and exactly,
where a table only depicts it. It is notation, not code to be run.

Keep this file to rules. Diagnosis and troubleshooting belong in README.md or in
a comment where the code is.

## Language

Chinese in conversation and UI copy. English in code, comments, documentation,
and commit messages.
