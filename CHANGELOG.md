## 0.1.2 (unreleased)


## 0.0.0 (unreleased)

- Bootstrap periodic workflows (audit, health, survey, changelog_autofill, repo_description_sync, completeness_check, copy_paste) via `.robotsix-mill/` presence files.

## 0.1.1 (2026-07-31)

## 0.1.0 (2026-07-30)

- Re-scope distribution to git-based: drop npm publish, add auto-release tagging (`v*`), and document git-install syntax in README.
- Initial scaffold of the `@robotsix/ui` shared component library with `ConfigPanel`, form primitives, CI pipeline, and build tooling.
- Add `ConfigPanel` component with schema-driven form rendering.
- Support `string`, `number`, `boolean`, and `select` field types.
- Export `FormField` primitive for standalone use.
- CI pipeline with lint, typecheck, test, and build.
