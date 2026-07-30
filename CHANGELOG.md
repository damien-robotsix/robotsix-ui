## 0.1.0 (unreleased)

- Re-scope distribution to git-based: drop npm publish, add auto-release tagging (`v*`), and document git-install syntax in README.
- Initial scaffold of the `@robotsix/ui` shared component library with `ConfigPanel`, form primitives, CI pipeline, and build tooling.
- Add `ConfigPanel` component with schema-driven form rendering.
- Support `string`, `number`, `boolean`, and `select` field types.
- Export `FormField` primitive for standalone use.
- CI pipeline with lint, typecheck, test, and build.
