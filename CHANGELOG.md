## 0.1.3 (unreleased)


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
