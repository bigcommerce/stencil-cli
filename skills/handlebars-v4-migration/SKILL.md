---
name: Handlebars v3 to v4 Migration
description: >-
    Use this skill when migrating a BigCommerce Stencil theme from Handlebars v3 to v4,
    upgrading the template engine, fixing context depth (../) issues in templates.
    Also triggers when the user asks about "handlebars upgrade",
    "template engine v4", "stencil handlebars migration", "../ not resolving correctly",
    "handlebars_v4 config.json", or "handlebars breaking changes".
    Also triggers when updating a CHANGELOG after a Handlebars migration.
    Always use this skill when the user mentions upgrading or migrating their theme's template engine.
---

# Handlebars v3 to v4 Migration

This skill guides you through migrating a BigCommerce Stencil theme from Handlebars v3 to v4.
There are four required steps — work through them in order.

---

## Step 1: Update config.json

Every Stencil theme has a `config.json` at the repo root. Find the `"version"` key and add the
engine flag immediately after it:

```json
{
  "version": "...",
  "template_engine": "handlebars_v4",
  ...
}
```

To revert, remove that line or set it to `"handlebars_v3"`.

---

## Step 2: Fix context depth (`../`) in templates

### What changed

**General rule:** in v4, a block helper creates a context frame **only if it actually changes the context**. In v3 this was inconsistent — conditional helpers also created frames even though they don't change context, so templates used extra `../` to compensate. In v4 that was fixed: conditional helpers (`{{#if}}`, `{{#unless}}`, and platform-level helpers like `{{#or}}`, `{{#and}}`, `{{#compare}}`, `{{#inArray}}`, `{{#any}}`) no longer create frames. This means existing `../` inside conditional blocks may now point one level too high.

| Helper                                                                                     | v3            | v4                                   |
| ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------ |
| `{{#if}}` / `{{#unless}}`                                                                  | created frame | **no frame** — `../` must be removed |
| Built-in or platform **conditional** helpers (`{{#or}}`, `{{#and}}`, `{{#compare}}`, etc.) | created frame | **no frame** — same rule as `#if`    |
| `{{#each}}` / `{{#with}}`                                                                  | creates frame | creates frame — no change needed     |
| Platform **iterator** helpers (`{{#for}}`, `{{#enumerate}}`)                               | creates frame | creates frame — no change needed     |

### Find all affected templates

Search the theme for every `../` occurrence:

```bash
grep -rn "\.\.\/" templates/ --include="*.html"
grep -rn "@\.\.\/" templates/ --include="*.html"
```

The second grep finds `@../` — Handlebars data variables from a parent context (e.g. `@../index`, `@../key`, `@../first`, `@../last`). These are special variables set automatically by `{{#each}}`. They follow the same rule as `../`: if `@../index` appears inside a conditional block (`{{#if}}`, `{{#unless}}`, etc.) that is nested inside `{{#each}}`, remove the `../` → `@index`. If it appears directly in the `{{#each}}` body with no conditional wrapper, leave it unchanged.

Review **every hit** in context of the helper it sits inside — some will need fixes, some won't.

### Pattern — `../` inside conditional block helpers (remove the `../`)

Because conditional block helpers (`#if`, `#unless`, `#or`, `#and`, etc.) no longer create a frame, `../` is now one level too high.

**Before (v3)**

```handlebars
{{#each items}}
  {{#if isActive}}
    {{../title}}
  {{/if}}
{{/each}}
```

**After (v4)**

```handlebars
{{#each items}}
  {{#if isActive}}
    {{title}}
  {{/if}}
{{/each}}
```

---

> _The required fix for Step 2 is complete. Optionally, continue below to refactor the same locations using block params._

### Optional: Refactor to block params

> **Sources:**
>
> -   Handlebars v4.0.0 release notes — context depth change: [handlebars-lang/handlebars.js — release-notes.md](https://github.com/handlebars-lang/handlebars.js/blob/master/release-notes.md)
> -   Block params syntax reference: [handlebarsjs.com — Block Helpers: Block Parameters](https://handlebarsjs.com/guide/block-helpers.html#block-parameters)

After removing `../`, the same locations can be further refactored to name the loop item explicitly with block params. This is optional — removing `../` is fully correct on its own. Block params make the intent clearer when a loop body is complex.

**This applies only when** the removed `../` referred to a **property of the loop item itself** (not the parent/root context).

**Before (after mandatory fix):**

```handlebars
{{#each products}}
  {{#if isActive}}
    <h2>{{title}}</h2>
  {{/if}}
{{/each}}
```

**After (block params refactor):**

```handlebars
{{#each products as |product|}}
  {{#if product.isActive}}
    <h2>{{product.title}}</h2>
  {{/if}}
{{/each}}
```

**Block params do NOT apply** when the original `../` was a deliberate exit to parent/root context — those were left unchanged in the mandatory fix and remain correct as-is.

#### Identify candidates for block params

Use the same files identified during the mandatory fix. For each location where `../` was removed, apply the two-check decision:

**Check 1 — confirm the removal happened inside a conditional block body.**
Only locations where `../` appeared inside a conditional helper (`{{#if}}`, `{{#unless}}`, `{{#or}}`, `{{#and}}`, `{{#compare}}`, etc.) that is itself inside a `{{#each}}` are candidates. A `../` removed directly from the `{{#each}}` body with no conditional wrapper is not a candidate.

```handlebars
{{#each items}}
  {{foo}}               ← was ../foo directly in #each body — skip, not a candidate

  {{#if condition}}
    {{bar}}             ← was ../bar inside conditional block body — candidate, proceed to Check 2
  {{/if}}
{{/each}}
```

**Check 2 — apply the decision rule** to each location identified in Check 1:

| Question                                                                   | Answer → Action                       |
| -------------------------------------------------------------------------- | ------------------------------------- |
| Did the removed `../prop` refer to a field on the **loop item**?           | Yes → apply block params              |
| Did the removed `../prop` refer to a field on the **parent/root context**? | Yes → skip, block params do not apply |

> **Universal rule — ask one question:** > **"Does every element in this array have this property?"**
>
> -   **Yes** → it belongs to the loop item → block params apply.
>     _(Examples: a product's `title`, an order's `status`, a variant's `price` — any field that varies per item)_
> -   **No** → it lives outside the array, in a wider context → skip.
>     _(Examples: global config, store settings, page-level data, parameters passed to a partial — anything that is the same regardless of which item you are on)_
>
> The property name is not a reliable signal. The question is purely structural:
> open the page's data object, find the array being iterated, and ask whether
> the property in question lives inside each element or outside the array entirely.

#### Offer block params to the user

After identifying candidates, present them to the user and ask:

> "Found N places where block params could be applied. This makes templates more explicit and avoids relying on context depth counting inside conditional blocks.
> Official reference: [handlebarsjs.com/guide/block-helpers.html#block-parameters](https://handlebarsjs.com/guide/block-helpers.html#block-parameters)
>
> Apply block params to these locations? (yes / no — the mandatory fix already applied is sufficient either way)"

If the user says **yes**, refactor each `{{#each items}}` that has the pattern to `{{#each items as |item|}}` and replace bare `prop` references with `item.prop` inside conditional blocks.
If the user says **no**, no further changes needed.

---

## Step 3: Regression testing

### Capture baseline snapshots (before the upgrade)

```bash
curl -L "https://store.example.com/" > baseline-home.html
curl -L "https://store.example.com/category/widgets/" > baseline-category.html
curl -L "https://store.example.com/widgets/widget-1/" > baseline-product.html
curl -L "https://store.example.com/cart" > baseline-cart.html
```

Repeat for all pages at risk:

-   Home page
-   Category page (with pagination)
-   Product page (with options/modifiers)
-   Cart / Checkout
-   Search results
-   Account: login + orders
-   Any custom templates (blog, brand, custom pages)

### Capture candidate snapshots (after the upgrade)

Apply the changes from Steps 1–2, install the candidate theme, then re-run the same curls,
saving to `candidate-*.html`.

### Diff and triage

```bash
diff -u baseline-home.html candidate-home.html | less
```

Some differences are expected and safe to ignore:

-   Script timestamps / "moment" variables
-   CDN cache-busting query parameters (`?t=...`)
-   Auto-generated IDs
-   Injected bootstrap content

Focus on differences in rendered text, link/image URLs, and template-driven content — these are the areas most affected by v4 changes.

### Visual regression

HTML diffs alone won't catch layout regressions. Take screenshots of the same page set
(baseline vs candidate) at desktop and mobile viewport sizes and compare side-by-side.
Pay particular attention to areas driven by `../` depth resolution: navigation menus, product grids, category trees.

---

## Step 4: Update the changelog (if present)

Check for a changelog file at the repo root:

```bash
ls CHANGELOG* CHANGES* HISTORY* 2>/dev/null
```

Common filenames: `CHANGELOG.md`, `CHANGELOG`, `CHANGES.md`, `HISTORY.md`.

If one exists, add an entry describing the migration. Match the existing format:

-   **Keep a Changelog** (uses `## [Unreleased]` / `## [x.y.z]` headings): add under `### Changed` in the `[Unreleased]` section.
-   **Date-based**: add a new entry at the top with today's date.
-   **Freeform**: follow the existing style.

Example entry:

```markdown
### Changed

-   Migrated template engine from Handlebars v3 to v4 (`"template_engine": "handlebars_v4"` in `config.json`)
-   Removed unnecessary `../` references inside conditional block helpers
```

If no changelog file is found, skip this step.

---

## Quick checklist

-   [ ] `config.json` updated: `"template_engine": "handlebars_v4"`
-   [ ] All `../` and `@../` occurrences reviewed
-   [ ] Unnecessary `../` inside conditional helpers (`#if`, `#unless`, `#or`, `#and`, `#compare`, `#inArray`, `#any`) removed
-   [ ] Baseline HTML snapshots captured
-   [ ] Candidate HTML snapshots captured and diffed
-   [ ] Visual regression pass completed on key pages
-   [ ] Changelog updated (if a changelog file exists)
