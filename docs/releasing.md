# Release strategy

## Versioning

`@robotsix/ui` uses [Changesets](https://github.com/changesets/changesets) for
semantic versioning and changelog generation. Every user-visible change lands
with a **changeset** — a small markdown file describing the change and its
semver impact (patch, minor, or major).

### Adding a changeset

After making a change, run:

```bash
npx changeset
```

Answer the prompts:

1. **Bump type**: `patch` (bug fix), `minor` (new feature), or `major` (breaking).
2. **Summary**: A one-line description that will appear in the changelog.

The generated `.md` file in `.changeset/` should be committed alongside your code.

### How releases work

1. **PRs with changesets** are merged to `main`.
2. The [`release.yml`](../.github/workflows/release.yml) workflow runs on push to
   `main`. It detects pending changesets and opens a **"Version Packages"** PR
   that bumps version numbers and updates `CHANGELOG.md`.
3. When the Version Packages PR is merged, the same workflow publishes the new
   version to npm under the **`next`** dist-tag.

All automated publishes land on the `next` dist-tag — **never `latest`** — so
consumers must explicitly opt in:

```bash
npm install @robotsix/ui@next
```

## Promoting to latest

The `latest` dist-tag is a **gated promotion**. It is only applied after a
`next` canary has been validated in at least one host integration
(central-deploy first).

### Gate policy

- A `next` canary **must** be validated by a host integration before promotion.
- The default integration target is the **central-deploy** host.
- The promotion is a manual step — no automation moves `next` to `latest`
  without a deliberate human decision.

### How to promote

Run the [Promote next to latest](../.github/workflows/promote-to-latest.yml)
workflow manually from the Actions tab:

1. Go to **Actions → Promote next to latest → Run workflow**.
2. Optionally specify a version; if left blank the current `@next` version is
   promoted.
3. The workflow runs `npm dist-tag add @robotsix/ui@<version> latest`, pointing
   the `latest` tag to the already-published tarball.

No rebuild or re-publish occurs — `npm dist-tag add` only moves the tag.

## Summary

```
dev change → changeset → merge to main
  → Version Packages PR (auto)
    → merge → publish to next (auto)
      → host integration validates
        → manual promote to latest
```
