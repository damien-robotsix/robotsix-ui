# Consuming robotsix-ui Styles

`@robotsix/ui` ships a single compiled stylesheet (`dist/style.css`) that
provides design tokens (CSS custom properties), a minimal reset, and
shared component styles. All visual primitives are **framework-agnostic**
— they work with React, plain HTML, or any other rendering layer.

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
so built artifacts (JS + CSS) are available immediately.

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
| **Tokens**     | `tokens.css`     | `--rsu-*` CSS custom properties: colors, spacing, typography, radii, shadows                                  |
| **Base**       | `base.css`       | Minimal reset (`box-sizing`, `body` defaults), typography, form normalization                                 |
| **Components** | `components.css` | Styles for `rsu-*`-prefixed classes: `.rsu-config-panel`, `.rsu-field`, `.rsu-btn`, `.rsu-badge`, `.rsu-card` |

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

### Dark theme

The base stylesheet supports dark mode via two mechanisms:

- **Explicit:** add `data-theme="dark"` to the `<html>` element
- **Automatic:** respects `prefers-color-scheme: dark` media query

Consumer repos can pick either approach. To lock to light mode, set
`data-theme="light"` on `<html>`.

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
