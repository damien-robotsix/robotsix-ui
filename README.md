# robotsix-ui

Shared UI component library for RobotSix deployed UIs.

## Installation

`@robotsix/ui` is distributed as a **git-based package** — there is no
public npm registry publish. Pin a git tag or commit SHA in your
`package.json`:

```json
"dependencies": {
  "@robotsix/ui": "git+https://github.com/damien-robotsix/robotsix-ui.git#v0.1.0"
}
```

The `prepare` script builds the library automatically when you run
`npm install`, so no pre-built artifacts are committed to the
repository.

## Usage

### The config panel

This library owns the fleet's **only** settings renderer. A component does not
write its own — it mounts this one, driven by the `config/config.schema.json`
it already commits and the standard config HTTP surface it already exposes
(`GET`/`PUT /config`, `GET /config/versions`, `POST /config/rollback`). That is
what makes every RobotSix UI present the same fields the same way.

Fleet UIs are server-rendered pages with no bundler, so they use the
React-free build:

```html
<link rel="stylesheet" href="/static/robotsix-ui.css" />
<div id="settings"></div>
<script type="module">
  import { mountConfigPanel } from "/static/robotsix-ui-vanilla.js";
  mountConfigPanel(document.getElementById("settings"), { title: "Settings" });
</script>
```

React hosts get the same panel through a thin wrapper:

```tsx
import { ConfigPanel } from "@robotsix/ui";
import "@robotsix/ui/style.css";

<ConfigPanel baseUrl="/api" title="Settings" />;
```

The panel handles typed inputs, nested and repeatable sections, masked secrets
with merge-on-write, the advanced-settings toggle, changed-keys-only saves,
inline validation errors, and version history with rollback.

| Schema                                    | Renders as                                   |
| ----------------------------------------- | -------------------------------------------- |
| `"type": "integer"` / `"number"`          | `<input type="number">`                      |
| `"type": "boolean"`                       | `<input type="checkbox">`                    |
| `"enum": [...]`                           | `<select>`                                   |
| `"type": "object"`                        | a titled section, nested to any depth        |
| `"type": "array"` of objects              | repeatable section with add/remove           |
| `"format": "password", "writeOnly": true` | masked input + set/unset badge, never echoed |
| `"advanced": true`                        | hidden behind "Show advanced settings"       |

## Standalone assets

Non-JS consumers (Python services, static sites, deployment scripts) can fetch
the built files directly from GitHub Releases — no npm required. Every version
tag publishes two:

```
https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/style.css
https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/vanilla.js
```

Replace `v0.1.34` with the desired version tag.

`style.css` is a single, self-contained stylesheet with all `--rsu-*` design
tokens, base reset, and component styles. `vanilla.js` is the framework-free
`@robotsix/ui/vanilla` build — an ES module exporting `mountConfigPanel`, with
no React and no bundler required. A component needs both: the stylesheet alone
styles a panel it has no way to mount.

```html
<link rel="stylesheet" href="/static/robotsix-ui.css" />
<div id="settings"></div>
<script type="module">
  import { mountConfigPanel } from "/static/robotsix-ui-vanilla.js";
  mountConfigPanel(document.getElementById("settings"));
</script>
```

A minimal Python helper is included for programmatic resolution:

```python
from robotsix_ui import css_url, vanilla_js_url

css_url("v0.1.34")
# → "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/style.css"
vanilla_js_url("v0.1.34")
# → "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/vanilla.js"
```

## Documentation

- [The shared config panel](docs/config-panel.md) — mounting it, the schema
  keywords it reads, and the `x-deploy-plane` ownership annotation.
- [Consuming robotsix-ui Styles](docs/consumption.md) — how to import and customize
  the shared design tokens and base stylesheet in consumer repos.

## Development

```bash
npm install
npm test          # run tests
npm run typecheck # type-check
npm run lint      # lint
npm run build     # build the library
```

## License

MIT — see [LICENSE](./LICENSE).
