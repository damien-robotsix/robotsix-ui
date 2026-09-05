## 0.1.49 (unreleased)

## [1.0.0](https://github.com/damien-robotsix/robotsix-ui/compare/v0.1.49...v1.0.0) (2026-09-05)


### ⚠ BREAKING CHANGES

* the ConfigField type and the FormField export are removed; ConfigPanel now takes a config surface (or an initial GET /config response) instead of a schema/config/onChange triple.

### Features

* Add a shared AppShell / navigation-menu component to robotsix-ui (fleet-wide menu unification, blocker) (20260821T094525Z-add-a-shared-appshell-navigation-menu-co-c896) ([#40](https://github.com/damien-robotsix/robotsix-ui/issues/40)) ([b56bec2](https://github.com/damien-robotsix/robotsix-ui/commit/b56bec274be072246bf90aad86a86fa634ba791b))
* ConfigPanel UX: foldable group headers, remove advanced-settings mechanism, smart grouping (20260902T151953Z-configpanel-ux-foldable-group-headers-re-cd3a) ([#78](https://github.com/damien-robotsix/robotsix-ui/issues/78)) ([0a655e5](https://github.com/damien-robotsix/robotsix-ui/commit/0a655e5b7be6a6f16b5ec67a28cd1c7255c35f06))
* **config:** render dict-valued config as keyed map sections ([#11](https://github.com/damien-robotsix/robotsix-ui/issues/11)) ([461e25e](https://github.com/damien-robotsix/robotsix-ui/commit/461e25ec6a9d076b7bd8bbc7a6f03eca18bc4342))
* Enable mypy_baseline periodic workflow on robotsix-ui (20260829T080848Z-enable-mypy-baseline-periodic-workflow-o-af72) ([#69](https://github.com/damien-robotsix/robotsix-ui/issues/69)) ([8c2ead5](https://github.com/damien-robotsix/robotsix-ui/commit/8c2ead5aec05dca80a2274d42993a1a0cad0abe2))
* Enable test_gap periodic workflow on robotsix-ui (20260829T080848Z-enable-test-gap-periodic-workflow-on-rob-4b60) ([#68](https://github.com/damien-robotsix/robotsix-ui/issues/68)) ([de19e26](https://github.com/damien-robotsix/robotsix-ui/commit/de19e26aa19d58ea422ee82dc8500bc19745f72a))
* make ConfigPanel the fleet's JSON-Schema-driven settings panel ([#10](https://github.com/damien-robotsix/robotsix-ui/issues/10)) ([91fd5de](https://github.com/damien-robotsix/robotsix-ui/commit/91fd5de1e51a0bcc0403b7cb37dd56e5a61d374b))
* **release:** publish the vanilla JS bundle as a release asset ([#39](https://github.com/damien-robotsix/robotsix-ui/issues/39)) ([5d82a66](https://github.com/damien-robotsix/robotsix-ui/commit/5d82a66a402b5377f4672232e3d25cc45980b27a))
* robotsix-ui: Distribute pre-built CSS as a standalone download for non-JS consumers (20260811T142428Z-robotsix-ui-distribute-pre-built-css-as-5db0) ([#36](https://github.com/damien-robotsix/robotsix-ui/issues/36)) ([6df47b8](https://github.com/damien-robotsix/robotsix-ui/commit/6df47b8dce0c236e640abe3e5f6e538d0e3ba974))
* robotsix-ui: package the robotsix_ui Python module so it is pip/uv-importable (20260829T094234Z-robotsix-ui-package-the-robotsix-ui-pyth-fec0) ([#70](https://github.com/damien-robotsix/robotsix-ui/issues/70)) ([3a6550d](https://github.com/damien-robotsix/robotsix-ui/commit/3a6550df9c9cf08a4716501de6ab120cf3fde83e))
* Tag git release v0.1.31 (componentId auto-derive) — git-tag only, NO registry publish (20260814T130953Z-tag-git-release-v0-1-31-componentid-auto-a0c3) ([#38](https://github.com/damien-robotsix/robotsix-ui/issues/38)) ([7af30c3](https://github.com/damien-robotsix/robotsix-ui/commit/7af30c33ebfefad7b858aca3e7a8d98396103c22))


### Bug Fixes

* CI failure: CI on main (20260809T144842Z-ci-failure-ci-on-main-ecfe) ([#31](https://github.com/damien-robotsix/robotsix-ui/issues/31)) ([2a11970](https://github.com/damien-robotsix/robotsix-ui/commit/2a119708c295b95cec7247dc8829352ada5a1d2c))
* CI failure: CI on main (20260821T185940Z-ci-failure-ci-on-main-839d) ([#56](https://github.com/damien-robotsix/robotsix-ui/issues/56)) ([21c9432](https://github.com/damien-robotsix/robotsix-ui/commit/21c94324cdbc1bd3f0c4f1f06766183401466c1c))
* ci_fix: out-of-scope CI failure — build, typecheck, lint, test (all fail at npm ci step) in package.json — resolve typescript / typescript-eslint peer dependency conflict (20260821T180414Z-ci-fix-out-of-scope-ci-failure-build-typ-91ca) ([#54](https://github.com/damien-robotsix/robotsix-ui/issues/54)) ([7f3d86f](https://github.com/damien-robotsix/robotsix-ui/commit/7f3d86f326bcfb5f9db54fe5c35b804ae397bc2e))
* **config:** refuse a response that carries no config document ([#57](https://github.com/damien-robotsix/robotsix-ui/issues/57)) ([bf65507](https://github.com/damien-robotsix/robotsix-ui/commit/bf65507394284cfeb2fd4f8b43542fb0f06b9a53))
* **docs:** put the module taxonomy in the schema's list form ([#25](https://github.com/damien-robotsix/robotsix-ui/issues/25)) ([f86edc0](https://github.com/damien-robotsix/robotsix-ui/commit/f86edc07b123e2ea0c8fb00961c535ffc1f64249))

## 0.1.48 (2026-08-29)

## 0.1.47 (2026-08-29)

## 0.1.46 (2026-08-29)

## 0.1.45 (2026-08-29)

## 0.1.44 (2026-08-29)

## 0.1.43 (2026-08-28)

## 0.1.42 (2026-08-28)

## 0.1.41 (2026-08-24)

## 0.1.40 (2026-08-22)

## 0.1.39 (2026-08-22)

## 0.1.38 (2026-08-22)

## 0.1.37 (2026-08-21)

## 0.1.36 (2026-08-21)

## 0.1.35 (2026-08-21)

## 0.1.34 (2026-08-21)

## 0.1.33 (2026-08-16)

## 0.1.32 (2026-08-14)

## 0.1.31 (2026-08-14)

- Add `componentId` option to the config panel. When set, map-entry keys
  (`langfuse.projects`, `openrouter.keys`) are auto-derived as read-only text
  rather than requiring manual entry, and the `project_id` field inside an
  object-valued map entry is auto-populated from the component id — eliminating
  redundant manual fields.
- Auto-release workflow now uploads `dist/style.css` as a GitHub Release asset
  on every version tag. Non-JS consumers can fetch the compiled stylesheet
  directly from the release download URL.
- Fix CI lint job by applying Prettier formatting to
  `.github/workflows/dependabot-auto-merge.yml` and `CHANGELOG.md`.
- Add AGENT.md with project context for AI coding tools (identity, architecture,
  commands, conventions, release flow).
- Use a function form with regex for `rollupOptions.external` to automatically
  externalize all React and ReactDOM subpath imports, instead of a hardcoded
  string array.
- Add `.robotsix-mill/config.yaml` declaring `languages: [typescript]` to
  prevent inappropriate Python-scoped periodic workflow proposals.
- Enable triage_boilerplate periodic agent for scanning triage tickets and
  proposing boilerplate response templates.

## 0.1.30 (2026-08-12)

## 0.1.29 (2026-08-12)

## 0.1.28 (2026-08-10)

## 0.1.27 (2026-08-10)

## 0.1.26 (2026-08-09)

## 0.1.25 (2026-08-09)

## 0.1.24 (2026-08-09)

## 0.1.23 (2026-08-09)

## 0.1.22 (2026-08-09)

## 0.1.21 (2026-08-09)

## 0.1.20 (2026-08-08)

## 0.1.19 (2026-08-08)

## 0.1.18 (2026-08-07)

## 0.1.17 (2026-08-07)

## 0.1.16 (2026-08-07)

## 0.1.15 (2026-08-06)

## 0.1.14 (2026-08-06)

## 0.1.13 (2026-08-03)

## 0.1.12 (2026-08-03)

## 0.1.11 (2026-08-03)

## 0.1.10 (2026-08-03)

## 0.1.9 (2026-08-03)

## 0.1.8 (2026-08-03)

## 0.1.7 (2026-08-02)

- Render open-ended maps (`dict[str, …]`, i.e. a schema node whose value type
  is in `additionalProperties`) as keyed, repeatable sections with an editable
  key, add/remove, and full support for object _or_ scalar values. Without
  this, the component standard's canonical credential blocks —
  `langfuse.projects` keyed by Langfuse project name and `openrouter.keys`
  keyed by the same aliases — rendered as a single unusable text input, so a
  component that had migrated its credentials to the standard shape could no
  longer set them from its own Settings panel.
- `diffConfigValues` accepts the schema as an optional third argument and
  diffs a map as one value. Diffed as a plain object, a _removed_ map entry
  cancelled out to nothing and the deletion never reached the surface.

## 0.1.6 (2026-08-02)

- **BREAKING** — `ConfigPanel` is now driven by a component's committed
  `config/config.schema.json` (JSON Schema) instead of a bespoke flat
  `ConfigField[]`. The old `ConfigField` type and the `FormField` export are
  removed. The panel is the fleet's reference settings UI: it implements the
  standard config HTTP surface (`GET`/`PUT /config`, `GET /config/versions`,
  `POST /config/rollback`) from robotsix-standards `config-ownership.md`, with
  typed inputs, nested sections, repeatable array sections, `writeOnly` secret
  masking with merge-on-write, the `advanced` toggle from `config-standard.md`
  § 4, changed-keys-only saves, inline `422` messages, and version history with
  rollback.
- Add a **framework-free** build, `@robotsix/ui/vanilla` (`dist/vanilla.js`),
  that imports no React — fleet UIs are server-rendered pages with no bundler
  and can load it directly with `<script type="module">`. The React
  `ConfigPanel` is a thin wrapper over the same core, so the two cannot render
  a component's settings differently.
- Add an `x-deploy-plane` field annotation so one renderer serves both planes:
  a panel edits the fields its own plane owns and shows the rest read-only,
  which keeps the deploy UI and a component's Settings panel from both writing
  the same key.
- Add config-panel styles (sections, rows, secret badges, array items, history
  table) to `components.css`; the shared form-control base moved from
  `.rsu-field` to `.rsu-config-row`.

## 0.0.0 (unreleased)

- Add vitest coverage instrumentation (`@vitest/coverage-v8`) with CI gating: `npm run test:coverage` produces lcov/html/text reports and fails CI when thresholds (90% statements/lines/functions, 80% branches) are not met. Drop unused `@testing-library/user-event` devDependency.
- Refactor `mountConfigPanel` into a module-scoped `ConfigPanelController` for
  independently testable behaviours; no behavioural change to the panel.
- Add round-trip test for array reindex→recollect after item removal, mirroring the existing map.test.ts pattern.
- Refactor `buildRow` in `src/config/render.ts` into six per-type row builder helpers (`buildSecretRow`, `buildJsonListRow`, `buildSelectRow`, `buildNumberRow`, `buildBooleanRow`, `buildTextRow`) with a small dispatcher, improving readability and testability.
- Remove orphan `src/types.ts` re-export module. The config types it
  re-exported (ConfigSchema, ConfigValues, etc.) are already surfaced at
  the package root via `src/index.ts` re-exporting `src/config/index.ts`.
  The module had no importers, no build entry, and no package export subpath.
- Deduplicate `cssEscape` and `isPlainObject` by extracting them into `html.ts` and `schema.ts` respectively (audit: dedup_css_escape_is_plain_object)
- Config panel: suppress redundant hover tooltip on setting rows that lack a schema description, instead of repeating the already-visible key name. Nested fields without a description still show their full dotted path for namespace context.
- Fix periodic workflow loading: move `.robotsix-mill/*.yml` to `.robotsix-mill/periodic/<name>.yaml` so the mill's periodic loader can discover them.
- Config panel: fix `more…` / `less` toggle for section-level descriptions. The toggle is now wired via event delegation so it works in section headers (not just field rows), and the dead per-row wiring is removed.
- Add `input[type="password"]` to the shared `.rsu-field` input selector so password fields inherit the same form-control styling as text/number inputs

## 0.1.5 (2026-08-02)

## 0.1.4 (2026-08-01)

- Make React and ReactDOM peer dependencies optional (`peerDependenciesMeta`) so
  consumers importing only the stylesheet (`import "@robotsix/ui/style.css"`)
  can install without React and without peer-dependency warnings.
- Add `--rsu-color-text-muted` design token for muted/dim text (light and dark
  themes).
- Add dark theme hue-tint mechanism: `--rsu-dark-hue` and `--rsu-dark-saturation`
  tokens control the hue of dark surfaces. Defaults to a subtle blue tint
  (hue 220); consumer repos override `--rsu-dark-hue` to match their board
  palette (set to 0 for neutral gray).
- Add `.sr-only` screen-reader-only utility class in new `src/styles/utilities.css`.
- Update consumption guide with peer-dependency note, text hierarchy table,
  dark hue-tint documentation, and accessibility utilities section.

## 0.1.3 (2026-08-01)

## 0.1.2 (2026-08-01)

- Add shared design tokens (`src/styles/tokens.css`): CSS custom properties for
  colors (primary, semantic status, neutral gray scale), spacing, typography,
  borders, shadows, and transitions. Includes light and dark theme support via
  `data-theme` attribute and `prefers-color-scheme` media query.
- Add base stylesheet (`src/styles/base.css`): minimal reset, typography
  defaults, form element normalization, and focus-ring styling.
- Add shared component styles (`src/styles/components.css`): styles for
  existing `rsu-*`-prefixed classes (ConfigPanel, FormField) plus placeholder
  styles for buttons (`.rsu-btn`), badges (`.rsu-badge--{status}`), and cards
  (`.rsu-card`).
- Ship compiled stylesheet as `dist/style.css`; add `style` and `sideEffects`
  fields to `package.json` for bundler compatibility.
- Document consumption path in `docs/consumption.md`: git-based installation,
  import options (bundler / HTML link / copy), token customization, and dark
  theme activation.
- Bootstrap periodic workflows (audit, health, survey, changelog_autofill, repo_description_sync, completeness_check, copy_paste) via `.robotsix-mill/` presence files.

## 0.1.1 (2026-07-31)

## 0.1.0 (2026-07-30)

- Re-scope distribution to git-based: drop npm publish, add auto-release tagging (`v*`), and document git-install syntax in README.
- Initial scaffold of the `@robotsix/ui` shared component library with `ConfigPanel`, form primitives, CI pipeline, and build tooling.
- Add `ConfigPanel` component with schema-driven form rendering.
- Support `string`, `number`, `boolean`, and `select` field types.
- Export `FormField` primitive for standalone use.
- CI pipeline with lint, typecheck, test, and build.
