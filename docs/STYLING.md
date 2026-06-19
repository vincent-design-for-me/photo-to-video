# Styling Architecture

How styles are organized in this project, and the rules new code must follow so
the stylesheet stays maintainable and pages never collide.

> Read this **together with `DESIGN.md`**. `DESIGN.md` is the source of truth for
> *what things look like* (tokens, components, spacing). This doc is the source of
> truth for *how styles are structured in code*.

---

## TL;DR for new work

1. **New component or page → create a `*.module.css` next to it.** Never add to
   the global `app/styles.css`.
2. **Use design tokens, not inline values.** Reference `var(--space-*)`,
   `var(--radius-*)`, and the color variables in `:root`. Don't hard-code hex or
   px that a token already covers.
3. **CSS Modules class names are local** — they're hashed at build time, so two
   files can both define `.card` with zero risk of conflict. Use plain, semantic
   names inside a module (`.card`, `.title`); don't prefix them.

That's it. The rest of this doc explains why and covers the legacy global file.

---

## Why this exists

`app/styles.css` grew to ~4,400 lines as a single global stylesheet imported once
in `app/layout.tsx`. Everything shares one global namespace, which means:

- Generic class names (`.pill`, `.hero`, `.badge`, `.primary`, `.status`) are
  globally scoped — a new page that reuses one of those words silently inherits
  old styling.
- The file is hard to navigate, merge, and safely delete dead rules from.

We are **not** rewriting it. The strategy is:

> **New code is physically isolated (CSS Modules); the old global file is frozen
> and converges over time.**

---

## The three layers

### 1. Global tokens & base — `app/styles.css` (`:root`, resets, element styles)

The single legitimate place for *truly global* CSS:

- **Design tokens** in `:root` — colors, `--space-*` spacing scale, `--radius-*`
  radius scale. These are the shared vocabulary every layer pulls from.
- **Resets / element defaults** — `* { box-sizing }`, `body`, `a`, `button`.

Add to `:root` only. Do **not** add new component/page classes here.

### 2. Legacy feature styles — rest of `app/styles.css` (frozen)

The existing 4,400 lines. **Rules:**

- Don't add new sections here. When you touch a feature that already lives here,
  prefer migrating that block into a `*.module.css` for the component you're
  editing, rather than extending the global block.
- Existing classes follow an informal **page-prefix convention** that acts as a
  poor-man's namespace — keep using it if you must edit in place:
  `lp-*` (landing), `auth-*`, `library-*`, `upload-*`, `history-*`, `job-*`,
  `review-*`, `lightbox-*`, `ba-*` (before/after), `modal-*`.
- **Bare generic names are the known hazard** (`.pill`, `.hero`, `.badge`,
  `.primary`, `.status`, `.card`). Never add more. If you need one of these
  concepts in new code, define it locally inside a module instead.

### 3. Component/page styles — `*.module.css` (all new work)

Co-locate a CSS Module with its component:

```
app/library/
  LibraryClient.tsx
  LibraryClient.module.css   ← styles for this component only
```

```tsx
import styles from "./LibraryClient.module.css";

export function LibraryClient() {
  return <div className={styles.card}>…</div>;
}
```

Next.js 15 supports CSS Modules natively — no config. Class names are hashed
(`.card` → `.LibraryClient_card__a1b2c`), so **conflicts are impossible by
construction**. This is the core guarantee that keeps future pages safe.

Inside a module, use **plain semantic names** (`.card`, `.title`, `.actions`).
Do not add page prefixes — scoping already does that job.

---

## Token usage

Always prefer a token over an inline value when one exists.

| Use | Token |
|---|---|
| Spacing / gaps / padding | `var(--space-xxs … --space-section)` |
| Border radius | `var(--radius-xs … --radius-pill)` |
| Colors | the `:root` color variables (`--ink`, `--canvas`, `--accent`, …) |

```css
/* Good */
.card { padding: var(--space-lg); border-radius: var(--radius-xl); }

/* Avoid in new code */
.card { padding: 24px; border-radius: 16px; }
```

`stylelint` enforces this for `*.module.css` (see below).

---

## ⚠️ Open issue: tokens diverge from DESIGN.md

The live `:root` colors (notably `--accent: #1c806e`, teal) **intentionally do not
match** the ElevenLabs palette documented in `DESIGN.md` (which forbids any
saturated accent and specifies `--ink: #0c0a09`, etc.).

This is an unresolved brand decision, **not** a bug to silently fix:

- **Option A** — DESIGN.md is a borrowed template; the live teal palette is the
  real brand → update DESIGN.md to match the code.
- **Option B** — DESIGN.md is the target; the implementation drifted → re-skin the
  site (a separate, deliberate design migration).

Until this is decided, **do not remap the existing color tokens**. Only the
brand-neutral structural tokens (`--space-*`, `--radius-*`) have been landed.

---

## Guardrail: stylelint

Config: `.stylelintrc.json`. Two scopes, on purpose:

- **`npm run lint:css`** (blocking) — lints only `app/**/*.module.css`, the new
  disciplined layer. Runs `stylelint-config-standard` **plus** a strict rule that
  requires `var()` for color/spacing/radius properties
  (`declaration-strict-value`) — i.e. **new code must use tokens, not inline
  hex/px**. Wired as `pretest`, so it runs ahead of `npm test`.
- **`npm run lint:css:legacy`** (advisory) — lints the frozen `app/styles.css`.
  It currently reports ~1,000 pre-existing cosmetic issues (empty lines, hex
  casing, media-query syntax), so it is intentionally **not** in the blocking
  path. Use it (optionally with `--fix`) when you deliberately clean up a legacy
  block. Don't bulk-autofix the whole file in an unrelated PR.

Run `npm run lint:css` before committing styling changes.
