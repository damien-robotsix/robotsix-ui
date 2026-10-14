# AGENT.md

## Project Identity

`@robotsix/ui` is the shared UI component library for RobotSix deployed UIs.
It is distributed as a **git-based npm package** (no public registry publish).
Consumers pin a git tag or commit SHA in their `package.json`:

```json
"@robotsix/ui": "git+https://github.com/damien-robotsix/robotsix-ui.git#v0.1.0"
```

The `prepare` script builds the library on `npm install`, so no pre-built
artifacts are committed.

### Canonical repository slug

The canonical GitHub slug for this repository is **`robotsix-ui`**
(`github.com/damien-robotsix/robotsix-ui`) — a live, distinct repository, not a
rename redirect. Every internal reference to the slug must use `robotsix-ui`:
`package.json` `repository.url`, the `_RELEASE_BASE` constant in
`robotsix_ui/__init__.py` (and its test), and the install/download URLs in
`README.md` and `docs/`. The `upload-assets` job in
`.github/workflows/release-please.yml` attaches release assets to this same
repository, so `css_url()` / `vanilla_js_url()` and the documented download
URLs resolve directly against `robotsix-ui`. Do not switch any of these to
another slug (e.g. `robotsix-mill`, the separate mill-tooling repository) — that
would break asset resolution.

The library owns the fleet's **only** settings renderer — a schema-driven
config panel. Components do not write their own settings UI; they mount this
one, driven by their committed `config/config.schema.json` and the standard
config HTTP surface (`GET`/`PUT /config`, `GET /config/versions`,
`POST /config/rollback`).

## Architecture

The library has two layers and two entry points.

### Per-module layout

Each module ships two co-located variants under `src/`:

- `src/<module-id>/` — the **framework-free core**: pure TypeScript / DOM with
  no React dependency, re-exported through `src/vanilla.ts` →
  `@robotsix/ui/vanilla` for server-rendered UIs that have no bundler (loaded
  via `<script type="module">`).
- `src/<module-id>-react/` — the **React wrapper**: a thin component that
  renders the framework-free core inside React, re-exported through
  `src/index.ts` → `@robotsix/ui` for React hosts with a bundler. The React
  wrapper imports its core from the sibling `../<module-id>/` directory.

This supersedes the previous `src/components/` pattern for React wrappers:
both variants of a module now live next to each other at `src/<module-id>/`
and `src/<module-id>-react/`. Every source and test file must still be listed
in `docs/modules.yaml` under its module.

The modules currently shipped are `config-panel` and `app-shell`.

### Config panel (`src/config-panel/` + `src/config-panel-react/`)

- Framework-free core modules: `panel.ts` (controller), `render.ts` (DOM
  generation), `schema.ts` (JSON Schema parsing), `client.ts` (HTTP client),
  `collect.ts` (form value collection), `html.ts` (utilities), `types.ts`.
  The vanilla entry exports `mountConfigPanel(element, options)`.
- React wrapper: `ConfigPanel.tsx` renders the framework-free panel inside a
  React component and exports `<ConfigPanel>`.

### App shell (`src/app-shell/` + `src/app-shell-react/`)

- Framework-free core (`src/app-shell/`): the vanilla app-shell mount, exported
  through `src/vanilla.ts`.
- React wrapper (`src/app-shell-react/`): the React component that renders the
  framework-free shell, exported through `src/index.ts`.

### Styles (`src/styles/`)

- Design tokens (`tokens.css`), base reset (`base.css`), component styles
  (`components.css`), utilities (`utilities.css`).
- Compiled to a single `dist/style.css` with no peer dependencies.
- All classes are prefixed `rsu-` (RobotSix UI).

### Build output

Vite produces `dist/` with ES modules (`.js`), CommonJS (`.cjs`), TypeScript
declarations (`.d.ts`), and the compiled stylesheet (`style.css`).

## Commands

```bash
npm run build       # Vite library build → dist/
npm run dev         # Vite build in watch mode
npm test            # Vitest (jsdom environment)
npm run test:coverage  # Vitest with coverage (thresholds: 90% lines/functions, 80% branches)
npm run lint        # ESLint on src/ + Stylelint on src/styles/**/*.css
npm run lint:css    # Stylelint on src/styles/**/*.css
npm run typecheck   # tsc --noEmit (strict mode)
npm run format      # Prettier --check
npm run format:fix  # Prettier --write
```

CI runs `lint`, `lint:css`, `format`, `typecheck`, `test:coverage`, and `build`
on every PR and push to `main`.

## Coding Conventions

- **TypeScript strict mode** (`tsconfig.json`: `strict: true`). Also:
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- **ESLint** flat config (`eslint.config.mjs`): extends `@eslint/js` recommended
  and `typescript-eslint` recommended. Unused vars are errors except those
  prefixed with `_`.
- **Prettier** (`.prettierrc`): semicolons on, double quotes, trailing commas
  everywhere, print width 100, tab width 2.
- **Testing**: Vitest with `jsdom` environment. Tests co-located with source
  as `*.test.ts` / `*.test.tsx`. Coverage thresholds enforced in CI.
- **CSS**: class names prefixed `rsu-`. Design tokens are CSS custom properties
  (e.g. `--rsu-color-primary`). Themes use `data-theme` attribute and
  `prefers-color-scheme`.
- **Stylelint** (`.stylelintrc.json`): extends `stylelint-config-standard` and
  enforces the naming contract — every class selector must match
  `^rsu-[a-z0-9-]+$` (`selector-class-pattern`) and every custom property must
  match `^rsu-[a-z0-9-]+$` (`custom-property-pattern`). The only sanctioned
  exceptions carry an inline `stylelint-disable-next-line` with a rationale
  (e.g. the public `.sr-only` accessibility utility). Run with `npm run
lint:css`; `--fix` auto-corrects most standard-config violations.
- **Module registration**: every source and test file must be listed in
  `docs/modules.yaml` under the appropriate module.

## Release Workflow

Releases are automated via [release-please](https://github.com/googleapis/release-please)
(`.github/workflows/release-please.yml`):

1. On every push to `main`, release-please analyses conventional-commit
   messages and opens (or updates) a release PR that bumps `package.json`
   version and updates `CHANGELOG.md`.
2. When the release PR is merged, release-please creates a GitHub Release
   with auto-generated notes. A follow-up job builds the library and uploads
   `style.css`, `vanilla.js`, and `vanilla.js.map` as release assets.

**Commit subjects and PR titles must be conventional**
(`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`/`test:`/`ci:`) — release-please
generates `CHANGELOG.md` from them. Do not hand-edit `CHANGELOG.md` entries or
`package.json` version; the release PR handles both.
