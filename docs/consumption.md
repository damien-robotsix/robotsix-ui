# Consuming robotsix-ui Styles

`@robotsix/ui` ships a single compiled stylesheet (`dist/style.css`) that
provides design tokens (CSS custom properties), a minimal reset, shared
component styles, and utility classes. All visual primitives are
**framework-agnostic** — they work with React, plain HTML, or any other
rendering layer, with **zero JavaScript peer dependencies** required for
stylesheet-only consumption.

## Git-based installation

Per the RobotSix fleet distribution policy, `@robotsix/ui` is consumed
via git — no npm registry publication. Pin a tag or commit SHA in your
`package.json`:

```json
"dependencies": {
  "@robotsix/ui": "git+https://github.com/damien-robotsix/robotsix-ui.git#v0.1.0"
}
```

The `prepare` script builds the library automatically on `npm install`,
so the compiled `dist/style.css` is available immediately — no build
toolchain needed on your side.

> **React is optional.** The package declares React and ReactDOM as
> _optional_ peer dependencies. If your project only imports the
> stylesheet (no JS components), `npm install` will succeed without
> React installed and without peer-dependency warnings.

## Importing the stylesheet

### Option A: JS/TS import (bundler)

If your project uses a bundler (Vite, webpack, Rollup, etc.) that
understands CSS imports:

```ts
import "@robotsix/ui/style.css";
```

The bundler will include the stylesheet in your app bundle.

### Option B: Direct path import (bundler)

```ts
import "@robotsix/ui/dist/style.css";
```

Equivalent to option A — use whichever your toolchain prefers.

### Option C: HTML `<link>` (no bundler)

```html
<link rel="stylesheet" href="node_modules/@robotsix/ui/dist/style.css" />
```

### Option D: Copy to your public directory

If your deployment does not serve `node_modules`, copy the file during
build:

```bash
cp node_modules/@robotsix/ui/dist/style.css public/vendor/robotsix-ui.css
```

Then link it from your HTML or import from your own bundle.

## What the stylesheet provides

| Layer          | File             | Purpose                                                                                                       |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **Tokens**     | `tokens.css`     | `--rsu-*` CSS custom properties: colors, spacing, typography, radii, shadows, dark theme hue controls         |
| **Base**       | `base.css`       | Minimal reset (`box-sizing`, `body` defaults), typography, form normalization                                 |
| **Components** | `components.css` | Styles for `rsu-*`-prefixed classes: `.rsu-config-panel`, `.rsu-field`, `.rsu-btn`, `.rsu-badge`, `.rsu-card` |
| **Utilities**  | `utilities.css`  | Accessibility helpers: `.sr-only` (screen-reader-only)                                                        |

## Customizing via design tokens

Consumer repos can **override any token** by defining the same custom
property in their own stylesheet _after_ importing `@robotsix/ui`. All
component styles reference tokens, so overrides propagate everywhere:

```css
/* my-app.css — loaded AFTER @robotsix/ui/style.css */
:root {
  --rsu-color-primary: #7c3aed; /* purple instead of blue */
  --rsu-radius-md: 0; /* square corners */
  --rsu-font-family: "Inter", sans-serif;
}
```

### Text hierarchy tokens

| Token                        | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `--rsu-color-text`           | Primary body text                         |
| `--rsu-color-text-secondary` | Secondary / less prominent text           |
| `--rsu-color-text-muted`     | Muted / dim text (placeholders, captions) |

All three are defined for both light and dark themes. Override them
individually per theme if needed.

### Dark theme

The base stylesheet supports dark mode via two mechanisms:

- **Explicit:** add `data-theme="dark"` to the `<html>` element
- **Automatic:** respects `prefers-color-scheme: dark` media query

Consumer repos can pick either approach. To lock to light mode, set
`data-theme="light"` on `<html>`.

#### Dark theme hue tint

The dark theme surfaces are **hue-tinted** by default (blue-leaning,
`--rsu-dark-hue: 220`). Consumer repos can shift the tint to match
their board palette by overriding one token:

```css
:root {
  --rsu-dark-hue: 260; /* purple tint */
}
```

Set `--rsu-dark-hue: 0` for a neutral (pure gray) dark theme, or any
value 0–360 to match your primary hue. The saturation level is
controlled by `--rsu-dark-saturation` (default `12%`).

| Token                   | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `--rsu-dark-hue`        | Hue angle for dark surfaces (default 220 — blue) |
| `--rsu-dark-saturation` | Saturation for dark surfaces (default 12%)       |

### Accessibility utilities

| Class      | Purpose                                                              |
| ---------- | -------------------------------------------------------------------- |
| `.sr-only` | Visually hides content while keeping it accessible to screen readers |

Use `.sr-only` for skip-to-content links, hidden form labels, and other
assistive-tech affordances that should not appear in the visual layout.

```html
<a class="sr-only" href="#main-content">Skip to main content</a>
```

## Repo-specific styling

Everything in `robotsix-ui` is intended to be shared. Repo-specific
styling (layout overrides, page chrome, domain-specific components)
**stays in the consumer repo**. The base provides the foundation;
each consumer layers its own styles on top.

## Upgrading

Pull a newer tag and reinstall:

```bash
npm install git+https://github.com/damien-robotsix/robotsix-ui.git#v0.2.0
```

Breaking changes in tokens are avoided where possible; if a token must
be removed, the changelog will document the migration path.
