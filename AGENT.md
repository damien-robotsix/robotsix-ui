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

The library owns the fleet's **only** settings renderer — a schema-driven
config panel. Components do not write their own settings UI; they mount this
one, driven by their committed `config/config.schema.json` and the standard
config HTTP surface (`GET`/`PUT /config`, `GET /config/versions`,
`POST /config/rollback`).

## Architecture

The library has two layers and two entry points:

### Framework-free core (`src/config/`)

- Pure TypeScript / DOM — no React dependency.
- Modules: `panel.ts` (controller), `render.ts` (DOM generation), `schema.ts`
  (JSON Schema parsing), `client.ts` (HTTP client), `collect.ts` (form value
  collection), `html.ts` (utilities), `types.ts`.
- Entry point: `src/vanilla.ts` → `@robotsix/ui/vanilla`.
  Exports `mountConfigPanel(element, options)` for server-rendered UIs that
  have no bundler — loaded via `<script type="module">`.

### React wrapper (`src/components/ConfigPanel/`)

- Thin wrapper: `ConfigPanel.tsx` renders the framework-free panel inside a
  React component.
- Entry point: `src/index.ts` → `@robotsix/ui`.
  Exports `<ConfigPanel>` for React hosts with a bundler.

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
npm run lint        # ESLint on src/
npm run typecheck   # tsc --noEmit (strict mode)
npm run format      # Prettier --check
npm run format:fix  # Prettier --write
```

CI runs `lint`, `format`, `typecheck`, `test:coverage`, and `build` on every
PR and push to `main`.

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
