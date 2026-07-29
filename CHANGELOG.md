# Changelog

## 0.1.0

- Initial scaffold of the `@robotsix/ui` shared component library.
- Add `ConfigPanel` component with schema-driven form rendering.
- Support `string`, `number`, `boolean`, and `select` field types.
- Export `FormField` primitive for standalone use.
- CI pipeline with lint, typecheck, test, and build.
- Set up Changesets for automated semver and changelog generation.
- Add `release.yml` workflow to publish canary releases to the `next` npm dist-tag.
- Add `promote-to-latest.yml` manual workflow for gated `next` → `latest` promotion.
- Document the release strategy and promotion gate policy in `docs/releasing.md`.
