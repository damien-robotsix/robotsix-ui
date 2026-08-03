## 0.1.11 (unreleased)


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

- Remove orphan `src/types.ts` re-export module. The config types it
  re-exported (ConfigSchema, ConfigValues, etc.) are already surfaced at
  the package root via `src/index.ts` re-exporting `src/config/index.ts`.
  The module had no importers, no build entry, and no package export subpath.
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
